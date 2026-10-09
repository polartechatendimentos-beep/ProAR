"use client";

import { use, useEffect, useState } from "react";
import { qrSvg } from "@/lib/qr-svg";

type PublicData = { label: string; branding: { name: string; subtitle: string; whatsapp: string }; equipment: { type: string; brand: string; model: string } };

export default function PrintEquipmentLabel({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<PublicData | null>(null);
  const [publicUrl, setPublicUrl] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setPublicUrl(`${window.location.origin}/equipamento/${encodeURIComponent(token)}`);
    fetch(`/api/public-equipment-history?token=${encodeURIComponent(token)}`, { cache:"no-store" })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error); return result; })
      .then(result => { if (active) setData(result); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Etiqueta indisponível."); });
    return () => { active = false; };
  }, [token]);
  return <main className="label-page">
    <meta name="robots" content="noindex,nofollow,noarchive"/>
    <style>{`
      .label-page{min-height:100vh;padding:30px;background:#eaf0f7;font-family:Arial,sans-serif;color:#052653}
      .label-actions{display:flex;justify-content:center;gap:12px;margin:0 auto 20px;flex-wrap:wrap}
      .label-actions button,.label-actions a{border:0;border-radius:10px;background:#07539c;color:white;font-size:14px;font-weight:bold;padding:12px 18px;cursor:pointer;text-decoration:none}
      .polar-label{width:110mm;min-height:70mm;margin:auto;padding:3mm;box-sizing:border-box;background:white;border:2mm solid #063f84;border-radius:6mm;display:grid;grid-template-columns:1.4fr 1fr;gap:3mm;box-shadow:0 12px 35px #122e4b22}
      .polar-left{display:flex;flex-direction:column;justify-content:space-between;min-width:0}
      .polar-brand{font-size:29px;font-weight:1000;font-style:italic;letter-spacing:-1.5px;color:#0655a8;line-height:1}
      .polar-brand small{display:block;font-size:9px;letter-spacing:3px;color:#072c5d;font-style:normal;margin-top:4px}
      .polar-subtitle{font-size:9px;font-weight:800;line-height:1.5;color:#072c5d}
      .polar-contact{background:#06366f;color:white;padding:6px 8px;border-radius:5px;font-size:10px;font-weight:800}
      .polar-footer{font-size:8px;color:#31557c}
      .polar-right{display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;min-width:0}
      .polar-right h2{font-size:10px;line-height:1.3;margin:0;color:#072c5d}
      .polar-qr{width:35mm;height:35mm;display:grid;place-items:center}
      .polar-qr svg{width:100%;height:100%;image-rendering:pixelated}
      .polar-serial{font-size:15px;font-weight:900;color:#071b37;white-space:nowrap}
      .polar-caption{font-size:8px;font-weight:bold;color:#234b7e}
      @media(max-width:600px){.label-page{padding:12px}.polar-label{transform:scale(.8);transform-origin:top left;margin-left:0}}
      @media print{
        @page{size:110mm 70mm;margin:0}
        html,body{margin:0!important;padding:0!important;background:white!important}
        .label-page{padding:0!important;min-height:0!important;background:white!important}
        .label-actions{display:none!important}
        .polar-label{width:110mm!important;height:70mm!important;min-height:0!important;box-shadow:none!important;transform:none!important;margin:0!important;break-inside:avoid}
        *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      }
    `}</style>
    <div className="label-actions"><button type="button" disabled={!data} onClick={()=>window.print()}>Imprimir etiqueta permanente</button><a href={publicUrl || "#"} target="_blank" rel="noopener noreferrer">Testar consulta do cliente</a></div>
    {error && <p role="alert" style={{textAlign:"center",color:"#a21f2b"}}>{error}</p>}
    {!error && !data && <p role="status" style={{textAlign:"center"}}>Preparando etiqueta...</p>}
    {data && <section className="polar-label" aria-label={`Etiqueta permanente ${data.label}`}>
      <div className="polar-left">
        <div className="polar-brand">{data.branding.name}<small>{data.branding.subtitle}</small></div>
        <div className="polar-subtitle">INSTALAÇÃO | MANUTENÇÃO | HIGIENIZAÇÃO | PMOC</div>
        {data.branding.whatsapp && <div className="polar-contact">WhatsApp {data.branding.whatsapp}</div>}
        <div className="polar-footer">ETIQUETA PERMANENTE • HISTÓRICO DE MANUTENÇÕES</div>
      </div>
      <div className="polar-right">
        <h2>CONSULTE O HISTÓRICO DE MANUTENÇÕES</h2>
        <div className="polar-qr" dangerouslySetInnerHTML={{ __html:publicUrl ? qrSvg(publicUrl) : "" }}/>
        <div className="polar-caption">Nº DE IDENTIFICAÇÃO PERMANENTE</div>
        <div className="polar-serial">{data.label}</div>
      </div>
    </section>}
  </main>;
}
