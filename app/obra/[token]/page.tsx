"use client";

import "./public-work-map.css";
import { AlertTriangle, Building2, History, House, ImageIcon, RefreshCw, X } from "lucide-react";
import { use, useEffect, useState } from "react";

type StagePhoto = { label: string; url: string };
type Update = { id: string; status: string; note?: string; responsible?: string; photo?: string; photos?: string[] | StagePhoto[]; createdAt: string };
type Incident = { id: string; type: "Perda" | "Roubo"; note?: string; photo: string; responsible: string; createdAt: string };
type WorkHouse = { id: string; block: string; lot: number; kind?: "house" | "common"; name?: string; status: string; note?: string; updatedAt?: string; photo?: string; history?: Update[]; incidents?: Incident[] };
type PublicMap = { title: string; workName?: string; houses: WorkHouse[]; updatedAt: string };
const colors = ["#ef4444", "#f59e0b", "#8b5cf6", "#06b6d4", "#3b82f6", "#16a34a"];
const statuses = ["AG. FRIGORÍGENA", "AG. ACABAMENTO", "AG. TUBULAÇÃO FORÇADA", "AG. EXAUSTOR", "AG. TAMPA FRIGORÍGENA", "SERVIÇO CONCLUÍDO"];
const legacy: Record<string,string> = { "AG FRIGORÍGENA":"AG. FRIGORÍGENA", "AG VENTO KIT":"AG. TUBULAÇÃO FORÇADA", "VENTOKIT E FRIGORÍGENA OK":"AG. TUBULAÇÃO FORÇADA", "AG ACABAMENTO":"AG. ACABAMENTO", "AG EXAUSTOR":"AG. EXAUSTOR", "AG TAMPA FRIGORÍGENA":"AG. TAMPA FRIGORÍGENA", "FIM":"SERVIÇO CONCLUÍDO" };
const normalizeStatus = (status: string) => legacy[status] || status;
const statusColor = (status: string) => colors[Math.max(0, statuses.indexOf(normalizeStatus(status)))] || "#64748b";
const updatePhotos = (update: Update): StagePhoto[] => (update.photos?.length ? update.photos : update.photo ? [update.photo] : []).map((photo,index) => typeof photo === "string" ? { label:`Foto ${index + 1}`,url:photo } : photo);

export default function PublicWorkMap({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [map, setMap] = useState<PublicMap | null>(null);
  const [selected, setSelected] = useState<WorkHouse | null>(null);
  const [error, setError] = useState("");
  const load = async () => { try { const response = await fetch(`/api/public-work-map?token=${encodeURIComponent(token)}`, { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setMap(result.map); setError(""); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar a obra."); } };
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 30000); return () => window.clearInterval(timer); }, [token]);
  const blocks = [...new Set(map?.houses.map(house => house.block) ?? [])];
  const completed = map?.houses.filter(house => normalizeStatus(house.status) === "SERVIÇO CONCLUÍDO").length ?? 0;
  const houseProgress = (house: WorkHouse) => Math.round(Math.max(0,statuses.indexOf(normalizeStatus(house.status))) / (statuses.length - 1) * 100);
  const progress = map?.houses.length ? Math.round(map.houses.reduce((total,house)=>total+houseProgress(house),0)/map.houses.length) : 0;
  const blockSummary = (block: string) => {
    const houses = map?.houses.filter(house => house.block === block) ?? [];
    const completed = houses.filter(house => normalizeStatus(house.status) === "SERVIÇO CONCLUÍDO").length;
    const inProgress = houses.filter(house => houseProgress(house) > 0 && houseProgress(house) < 100).length;
    const pending = houses.length - completed - inProgress;
    const average = houses.length ? Math.round(houses.reduce((sum, house) => sum + houseProgress(house), 0) / houses.length) : 0;
    return { houses, completed, inProgress, pending, average };
  };
  const workName = map?.workName || map?.title?.split("—").pop()?.trim() || "Obra";
  return <main className="public-map-page"><header><img src="/proar-logo.png" alt="ProAR"/><div><span>ACOMPANHAMENTO EM TEMPO REAL</span><h1>{workName}</h1><p>Atualização automática a cada 30 segundos • clique duas vezes numa unidade para consultar o histórico.</p></div><button onClick={load}><RefreshCw size={16}/> Atualizar</button></header>{error ? <section className="public-map-error">{error}</section> : !map ? <section className="public-map-loading">A carregar o andamento da obra...</section> : <><section className="public-work-name"><span>OBRA</span><strong>{workName}</strong><small>{map.houses.length} unidades acompanhadas pela PolarTech</small></section>
<section className="public-map-summary"><div><small>PROGRESSO GERAL</small><strong>{progress}%</strong><i><b style={{width:`${progress}%`}}/></i></div><span>Avanço calculado por etapa • {completed} de {map.houses.length} unidades finalizadas</span><time>Última atualização: {new Date(map.updatedAt).toLocaleString("pt-BR")}</time></section>
<nav>{statuses.map(status => <span key={status}><i style={{background:statusColor(status)}}/>{status}</span>)}</nav><div className="public-blocks">{blocks.map(block => { const summary=blockSummary(block); return <section key={block}><header><div><b>{block === "Áreas Comuns" ? "ÁREAS COMUNS" : `QUADRA ${block}`}</b><small>{summary.houses.length} unidades • {summary.completed} concluídas • {summary.inProgress} em execução • {summary.pending} pendentes</small><div className="public-block-progress"><i><b style={{width:`${summary.average}%`}}/></i><strong>{summary.average}%</strong></div></div><span>{summary.completed}/{summary.houses.length} concluídas</span></header><div>{summary.houses.map(house => <article key={house.id} style={{"--status":statusColor(house.status)} as React.CSSProperties} onDoubleClick={() => setSelected(house)}><span>{house.kind === "common" ? <Building2 size={17}/> : <House size={17}/>}</span><h2>{house.kind === "common" ? house.name : `Casa ${String(house.lot).padStart(2,"0")}`}</h2><p><i/>{normalizeStatus(house.status)}</p>
<small>{house.updatedAt ? new Date(house.updatedAt).toLocaleString("pt-BR") : "Sem atualizações"}</small><div className="public-house-progress"><i><b style={{width:`${houseProgress(house)}%`}}/></i><span>{houseProgress(house)}%</span></div>
{house.photo && <img src={house.photo} alt={house.name || `Casa ${house.lot}`}/>} {house.incidents?.length ? <em className="public-incident-badge"><AlertTriangle size={11}/>{house.incidents.length} ocorrência(s)</em> : null}<button onClick={() => setSelected(house)}><History size={13}/> Ver histórico</button></article>)}</div></section>; })}</div></>}{selected && <div className="public-history-layer"><button aria-label="Fechar" onClick={() => setSelected(null)}/><section><header><div><span>{selected.kind === "common" ? "ÁREA COMUM" : `QUADRA ${selected.block}`}</span><h2>{selected.kind === "common" ? selected.name : `Casa / lote ${String(selected.lot).padStart(2,"0")}`}</h2></div><button onClick={() => setSelected(null)}><X size={17}/></button></header><div className="public-history-list">{selected.history?.length ? [...selected.history].reverse().map(update => <article key={update.id}><i style={{background:statusColor(update.status)}}/><div><header><b>{normalizeStatus(update.status)}</b><time>{new Date(update.createdAt).toLocaleString("pt-BR")}</time></header><p><strong>Responsável: {update.responsible || "Não informado"}</strong><br/>{update.note || "Sem observações."}</p><div>{updatePhotos(update).map(photo => <figure key={photo.label}><img src={photo.url} alt={photo.label}/><figcaption>{photo.label}</figcaption></figure>)}</div></div></article>) : <p className="empty-history"><ImageIcon size={22}/>Nenhuma alteração registrada.</p>}</div>{selected.incidents?.length ? <section className="public-incidents"><header><AlertTriangle size={15}/><div><b>Perdas e Roubos</b><small>{selected.incidents.length} ocorrência(s) registrada(s)</small></div></header><div>{selected.incidents.map(incident=><article key={incident.id}><img src={incident.photo} alt={incident.type}/><div><strong>{incident.type}</strong><time>{new Date(incident.createdAt).toLocaleString("pt-BR")}</time><p>{incident.note || "Sem observações."}</p>
<small>Responsável: {incident.responsible}</small></div></article>)}</div></section> : null}</section></div>}</main>;
}
