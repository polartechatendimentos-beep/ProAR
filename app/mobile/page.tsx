"use client";
import React,{useEffect,useState} from "react";
import {Moon,Sun,Smartphone,ClipboardCheck,Camera,QrCode,Users,WifiOff,RefreshCw,ShieldAlert} from "lucide-react";
import {getLocalEvents,saveLocalEvent,type MobileDraftEvent} from "@/lib/mobile/offline-queue";
type Theme="light"|"dark"|"auto";
type Section="inicio"|"checklist"|"fotos"|"equipamento"|"supervisao";
const questions:Record<string,string[]>={
 "split":["Identificação e número de série conferidos","Alimentação elétrica e segurança verificadas","Filtros e serpentinas inspecionados","Dreno e vazamentos inspecionados"],
 "cassete":["Identificação e número de série conferidos","Alimentação elétrica e segurança verificadas","Bomba e bandeja de condensado inspecionadas","Filtros, serpentinas e drenagem verificados"],
 "piso-teto":["Identificação e número de série conferidos","Alimentação elétrica e segurança verificadas","Fixações e ventilação inspecionadas","Drenagem e serpentinas verificadas"]
};
export default function ProARMobilePage(){
 const [theme,setTheme]=useState<Theme>("auto");
 const [systemDark,setSystemDark]=useState(false);
 const [section,setSection]=useState<Section>("inicio");
 const [equipmentType,setEquipmentType]=useState("split");
 const [osId,setOsId]=useState("");
 const [answers,setAnswers]=useState<Record<string,boolean>>({});
 const [photoBefore,setPhotoBefore]=useState<string|null>(null);
 const [photoAfter,setPhotoAfter]=useState<string|null>(null);
 const [queue,setQueue]=useState<MobileDraftEvent[]>([]);
 const [message,setMessage]=useState("");
 const [online,setOnline]=useState(true);
 const [qr,setQr]=useState("");
 useEffect(()=>{
  try {const stored=localStorage.getItem("proar-mobile-theme");if(stored==="light"||stored==="dark"||stored==="auto")setTheme(stored);}catch{}
  const media=window.matchMedia("(prefers-color-scheme: dark)");
  const update=()=>setSystemDark(media.matches);update();media.addEventListener("change",update);
  const connection=()=>setOnline(navigator.onLine);connection();window.addEventListener("online",connection);window.addEventListener("offline",connection);
  getLocalEvents().then(setQueue).catch(()=>setMessage("Armazenamento offline indisponível neste dispositivo."));
  return()=>{media.removeEventListener("change",update);window.removeEventListener("online",connection);window.removeEventListener("offline",connection);};
 },[]);
 const dark=theme==="dark"||(theme==="auto"&&systemDark);
 const colors=dark?"bg-slate-950 text-slate-100":"bg-slate-50 text-slate-900";
 const panel=dark?"bg-slate-900 border-slate-700":"bg-white border-slate-200";
 function changeTheme(value:Theme){setTheme(value);try{localStorage.setItem("proar-mobile-theme",value);}catch{}}
 async function draft(type:MobileDraftEvent["type"],payload:Record<string,unknown>){
  if(!osId.trim()){setMessage("Informe o número da OS real antes de registrar um rascunho.");return;}
  const event:MobileDraftEvent={id:crypto.randomUUID(),osId:osId.trim(),type,payload,createdAt:new Date().toISOString(),status:"local"};
  try{await saveLocalEvent(event);setQueue(await getLocalEvents());setMessage("Rascunho salvo somente neste dispositivo. Ainda não sincronizado com o ProAR.");}
  catch{setMessage("Falha ao salvar localmente. Não feche a tela antes de registrar os dados.");}
 }
 function loadPhoto(file:File|undefined,kind:"before"|"after"){
  if(!file)return;
  if(!file.type.startsWith("image/")||file.size>8_000_000){setMessage("Escolha uma imagem de até 8 MB.");return;}
  const reader=new FileReader();reader.onload=()=>{const url=String(reader.result);if(kind==="before")setPhotoBefore(url);else setPhotoAfter(url);};reader.readAsDataURL(file);
 }
 const nav:[Section,string,React.ReactNode][]=[["inicio","Início",<Smartphone key="i" size={18}/>],["checklist","Checklist",<ClipboardCheck key="c" size={18}/>],["fotos","Fotos",<Camera key="f" size={18}/>],["equipamento","QR / Histórico",<QrCode key="q" size={18}/>],["supervisao","Supervisão",<Users key="s" size={18}/>]];
 return <div className={`min-h-screen ${colors}`}>
  <header className="sticky top-0 z-20 bg-slate-900 text-white px-4 py-3 flex items-center justify-between gap-2"><div><strong>ProAR Mobile</strong><p className="text-xs text-slate-300">Operação de campo • versão de desenvolvimento</p></div><div className="flex items-center gap-2">{!online&&<WifiOff size={16} aria-label="Sem conexão"/>}<Sun size={15}/><select aria-label="Aparência" value={theme} onChange={e=>changeTheme(e.target.value as Theme)} className="bg-slate-800 text-white text-xs rounded p-2"><option value="light">Claro</option><option value="dark">Escuro</option><option value="auto">Automático</option></select><Moon size={15}/></div></header>
  <main className="max-w-xl mx-auto px-4 py-4 pb-24 space-y-4">
   <div className={`rounded-xl border p-3 ${panel}`}><div className="flex items-center justify-between"><strong className="text-sm">Identificação da OS</strong><span className="text-xs">{queue.length} rascunho(s) local(is)</span></div><label htmlFor="mobile-os" className="block text-xs mt-2 mb-1">Número da OS (não validado)</label><input id="mobile-os" value={osId} onChange={e=>setOsId(e.target.value)} placeholder="Informe a OS existente" className={`w-full border rounded-lg p-2 text-sm ${dark?"bg-slate-800 border-slate-600":"bg-white border-slate-300"}`}/></div>
   {message&&<p role="status" className="rounded-lg border border-amber-400 p-3 text-xs">{message}</p>}
   {section==="inicio"&&<div className={`rounded-xl border p-4 space-y-3 ${panel}`}><h1 className="font-bold text-lg">Atendimento de campo</h1><p className="text-sm">Selecione uma função abaixo. Os registros desta versão são rascunhos locais e não alteram o banco real.</p><button className="rounded-lg bg-blue-600 text-white p-3 w-full" onClick={()=>setSection("checklist")}>Iniciar checklist</button><button className="rounded-lg border p-3 w-full" onClick={()=>draft("checkin",{source:"manual",locationVerified:false})}>Registrar rascunho de chegada (sem GPS)</button></div>}
   {section==="checklist"&&<div className={`rounded-xl border p-4 space-y-3 ${panel}`}><h2 className="font-bold">Checklist por equipamento</h2><label className="block text-sm">Tipo de equipamento <select value={equipmentType} onChange={e=>{setEquipmentType(e.target.value);setAnswers({});}} className={`w-full mt-1 border rounded-lg p-2 ${dark?"bg-slate-800 border-slate-600":"bg-white"}`}><option value="split">Split</option><option value="cassete">Cassete</option><option value="piso-teto">Piso-teto</option></select></label>{questions[equipmentType].map((q,i)=><label key={q} className="flex gap-3 items-start text-sm"><input type="checkbox" className="mt-1" checked={!!answers[q]} onChange={e=>setAnswers(a=>({...a,[q]:e.target.checked}))}/><span>{i+1}. {q}</span></label>)}<button disabled={!questions[equipmentType].every(q=>answers[q])} onClick={()=>draft("checklist",{equipmentType,answers,templateVersion:1})} className="rounded-lg bg-blue-600 disabled:opacity-40 text-white p-3 w-full">Salvar checklist offline</button><p className="text-xs opacity-75">Modelo inicial de inspeção. Não substitui procedimento técnico ou PMOC aprovado.</p></div>}
   {section==="fotos"&&<div className={`rounded-xl border p-4 space-y-3 ${panel}`}><h2 className="font-bold">Fotos guiadas • Antes e depois</h2>{([["before","Antes",photoBefore],["after","Depois",photoAfter]] as const).map(([kind,label,photo])=><div key={kind} className="space-y-2"><label className="block text-sm">{label}<input type="file" accept="image/*" capture="environment" onChange={e=>loadPhoto(e.target.files?.[0],kind)} className="block w-full mt-1 text-xs"/></label>{photo&&<img src={photo} alt={`Prévia ${label.toLowerCase()}`} className="w-full max-h-48 object-contain rounded-lg border"/>}</div>)}<p className="text-xs text-amber-600">Pré-visualização temporária: as imagens não são persistidas nesta versão. Não considere fotos enviadas ou salvas.</p><button disabled={!photoBefore||!photoAfter} onClick={()=>draft("photo-metadata",{beforeCaptured:true,afterCaptured:true,photosPersisted:false})} className="rounded-lg bg-blue-600 text-white p-3 w-full disabled:opacity-40">Salvar registro das evidências (sem imagens)</button></div>}
   {section==="equipamento"&&<div className={`rounded-xl border p-4 space-y-3 ${panel}`}><h2 className="font-bold">Etiqueta e histórico permanente</h2><p className="text-sm">Informe ou cole o código da etiqueta. A consulta ao histórico real depende de uma API autenticada e vinculada à empresa.</p><input aria-label="Código QR ou número de série" value={qr} onChange={e=>setQr(e.target.value)} placeholder="Código da etiqueta / número de série" className={`w-full border rounded-lg p-2 ${dark?"bg-slate-800 border-slate-600":"bg-white"}`}/><p className="text-xs opacity-70">Leitura por câmera e histórico ainda não conectados. Nenhum equipamento fictício é exibido.</p></div>}
   {section==="supervisao"&&<div className={`rounded-xl border p-4 space-y-3 ${panel}`}><h2 className="font-bold">Painel de supervisão</h2><p className="text-sm">Prévia local de pendências deste dispositivo: {queue.length} evento(s) aguardando integração.</p><p className="text-xs opacity-75">Indicadores de equipes, produtividade e OS reais só serão exibidos após validação de perfil, tenant e permissões no servidor.</p></div>}
   <div className={`rounded-xl border p-3 text-xs flex gap-2 items-start ${panel}`}><ShieldAlert size={17} className="shrink-0"/><span><strong>Sincronização bloqueada por segurança.</strong> Os rascunhos ficam no dispositivo. O envio automático será habilitado somente após existir endpoint autenticado, idempotente e isolado por empresa. Não apague os dados do navegador.</span></div>
  </main>
  <nav aria-label="Navegação ProAR Mobile" className={`fixed bottom-0 inset-x-0 border-t z-30 ${dark?"bg-slate-900 border-slate-700":"bg-white border-slate-200"}`}><div className="max-w-xl mx-auto grid grid-cols-5">{nav.map(([id,label,icon])=><button key={id} type="button" onClick={()=>setSection(id)} aria-current={section===id?"page":undefined} className={`flex flex-col items-center gap-1 py-3 px-1 text-[10px] ${section===id?"text-blue-500 font-bold":"opacity-70"}`}>{icon}<span>{label}</span></button>)}</div></nav>
 </div>;
}
