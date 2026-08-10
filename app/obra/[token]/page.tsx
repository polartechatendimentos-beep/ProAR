"use client";

import "./public-work-map.css";
import { History, House, ImageIcon, RefreshCw, X } from "lucide-react";
import { use, useEffect, useState } from "react";

type Update = { id: string; status: string; note?: string; photo?: string; photos?: string[]; createdAt: string };
type WorkHouse = { id: string; block: string; lot: number; status: string; note?: string; updatedAt?: string; photo?: string; history?: Update[] };
type PublicMap = { title: string; houses: WorkHouse[]; updatedAt: string };
const colors = ["#ef4444", "#f97316", "#eab308", "#8b5cf6", "#06b6d4", "#3b82f6", "#16a34a"];
const statuses = ["AG FRIGORÍGENA", "AG VENTO KIT", "VENTOKIT E FRIGORÍGENA OK", "AG ACABAMENTO", "AG EXAUSTOR", "AG TAMPA FRIGORÍGENA", "FIM"];
const statusColor = (status: string) => colors[Math.max(0, statuses.indexOf(status))] || "#64748b";

export default function PublicWorkMap({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [map, setMap] = useState<PublicMap | null>(null);
  const [selected, setSelected] = useState<WorkHouse | null>(null);
  const [error, setError] = useState("");
  const load = async () => { try { const response = await fetch(`/api/public-work-map?token=${encodeURIComponent(token)}`, { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.error); setMap(result.map); setError(""); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar a obra."); } };
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 30000); return () => window.clearInterval(timer); }, [token]);
  const blocks = [...new Set(map?.houses.map(house => house.block) ?? [])];
  const completed = map?.houses.filter(house => house.status === "FIM").length ?? 0;
  return <main className="public-map-page"><header><img src="/proar-logo.png" alt="ProAR"/><div><span>ACOMPANHAMENTO EM TEMPO REAL</span><h1>{map?.title || "Mapa da obra"}</h1><p>Atualização automática a cada 30 segundos • clique duas vezes numa casa para consultar o histórico.</p></div><button onClick={load}><RefreshCw size={16}/> Atualizar</button></header>{error ? <section className="public-map-error">{error}</section> : !map ? <section className="public-map-loading">A carregar o andamento da obra...</section> : <><section className="public-map-summary"><div><small>PROGRESSO GERAL</small><strong>{Math.round(completed / Math.max(1, map.houses.length) * 100)}%</strong><i><b style={{width:`${completed / Math.max(1, map.houses.length) * 100}%`}}/></i></div><span>{completed} de {map.houses.length} casas finalizadas</span><time>Última atualização: {new Date(map.updatedAt).toLocaleString("pt-BR")}</time></section><nav>{statuses.map(status => <span key={status}><i style={{background:statusColor(status)}}/>{status}</span>)}</nav><div className="public-blocks">{blocks.map(block => <section key={block}><header><b>QUADRA {block}</b><span>{map.houses.filter(house => house.block === block && house.status === "FIM").length}/{map.houses.filter(house => house.block === block).length} concluídas</span></header><div>{map.houses.filter(house => house.block === block).map(house => <article key={house.id} style={{"--status":statusColor(house.status)} as React.CSSProperties} onDoubleClick={() => setSelected(house)}><span><House size={17}/></span><h2>Casa {String(house.lot).padStart(2,"0")}</h2><p><i/>{house.status}</p><small>{house.updatedAt ? new Date(house.updatedAt).toLocaleString("pt-BR") : "Sem atualizações"}</small>{house.photo && <img src={house.photo} alt={`Casa ${house.lot}`}/>}<button onClick={() => setSelected(house)}><History size={13}/> Ver histórico</button></article>)}</div></section>)}</div></>}{selected && <div className="public-history-layer"><button aria-label="Fechar" onClick={() => setSelected(null)}/><section><header><div><span>QUADRA {selected.block}</span><h2>Casa / lote {String(selected.lot).padStart(2,"0")}</h2></div><button onClick={() => setSelected(null)}><X size={17}/></button></header><div className="public-history-list">{selected.history?.length ? [...selected.history].reverse().map(update => <article key={update.id}><i style={{background:statusColor(update.status)}}/><div><header><b>{update.status}</b><time>{new Date(update.createdAt).toLocaleString("pt-BR")}</time></header><p>{update.note || "Sem observações."}</p><div>{(update.photos?.length ? update.photos : update.photo ? [update.photo] : []).map((photo,index) => <img key={index} src={photo} alt={`Foto ${index + 1}`}/>)}</div></div></article>) : <p className="empty-history"><ImageIcon size={22}/>Nenhuma alteração registrada.</p>}</div></section></div>}</main>;
}
