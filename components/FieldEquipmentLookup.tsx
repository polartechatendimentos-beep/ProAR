"use client";
import {useEffect,useRef,useState} from "react";
import {barcodeScannerSupported,openRearCamera,scanBarcodeFromVideo} from "@/lib/mobile-barcode";
import {resolveEquipmentLabel} from "@/lib/mobile-experience";
import styles from "./ProARFieldMobile.module.css";
export function FieldEquipmentLookup({options,onFound,disabled}:{options:{id:string;label:string}[];onFound:(id:string)=>void;disabled:boolean}) {
  const [value,setValue]=useState(""),[scanning,setScanning]=useState(false),[notice,setNotice]=useState("");
  const video=useRef<HTMLVideoElement|null>(null);
  useEffect(()=>{
    const hidden=()=>{if(document.hidden)setScanning(false);};
    document.addEventListener("visibilitychange",hidden);
    return()=>document.removeEventListener("visibilitychange",hidden);
  },[]);
  function lookup(raw:string) {
    const id=resolveEquipmentLabel(raw,window.location.origin,options.map(item=>item.id));
    if(!id){setNotice("Etiqueta não reconhecida nos equipamentos autorizados desta OS. Selecione o equipamento na lista.");return;}
    setNotice("");onFound(id);
  }
  useEffect(()=>{
    if(!scanning||disabled)return;
    let cancelled=false,stop:(()=>void)|undefined,timer:ReturnType<typeof setTimeout>|undefined;
    async function start() {
      try {
        if(!barcodeScannerSupported())throw new Error("Leitura pela câmera indisponível. Cole o código ou use a lista.");
        const node=video.current;if(!node)return;
        const release=await openRearCamera(node);
        if(cancelled){release();return;}stop=release;
        const scan=async()=>{
          if(cancelled)return;
          try{const result=await scanBarcodeFromVideo(node);if(cancelled)return;if(result){setValue(result.value);setScanning(false);setNotice("Código lido. Toque em Consultar etiqueta para validar o vínculo com a OS.");return;}}
          catch {if(!cancelled){setNotice("Não foi possível ler a etiqueta. Cole o código ou use a lista.");setScanning(false);}return;}
          if(!cancelled)timer=setTimeout(()=>void scan(),400);
        };
        void scan();
      }catch {if(!cancelled){setNotice("Câmera indisponível ou acesso não permitido. Cole o código ou use a lista.");setScanning(false);}}
    }
    void start();
    return()=>{cancelled=true;if(timer)clearTimeout(timer);stop?.();};
  },[scanning,disabled]);
  return <div><label className={styles.formLabel}>Etiqueta • ID do equipamento ou link com equipmentId<input maxLength={2048} value={value} disabled={disabled} onChange={e=>setValue(e.target.value)}/></label>
    <button type="button" className={styles.secondaryAction} disabled={disabled||!value.trim()} onClick={()=>lookup(value)}>Consultar etiqueta</button>
    <button type="button" className={styles.secondaryAction} disabled={disabled} aria-pressed={scanning} onClick={()=>setScanning(v=>!v)}>{scanning?"Fechar câmera":"Ler QR Code pela câmera"}</button>
    {scanning&&!disabled&&<video ref={video} muted playsInline autoPlay aria-label="Leitor de etiqueta" style={{width:"100%",maxHeight:240}}/>}
    {notice&&<p role="status">{notice}</p>}
  </div>;
}
