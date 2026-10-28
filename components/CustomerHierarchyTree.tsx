"use client";
import { useMemo, useState } from "react";
import { Building2, ChevronDown, ChevronRight, MapPin, Search } from "lucide-react";
import { customerHierarchy, filterHierarchy, visibleHierarchyNodes, hierarchySelection, hierarchyCounts, type HierarchyCustomer, type HierarchyRecord, type HierarchySelection } from "@/lib/customer-hierarchy";
import { useCustomerHierarchy } from "./CustomerHierarchyContext";
import "./customer-hierarchy.css";
type Props = { customer: HierarchyCustomer; records: HierarchyRecord[]; customers?: HierarchyCustomer[]; value?: string; onSelect?: (selection: HierarchySelection) => void; onEdit?: (id:string) => void; includeInactive?: boolean; disabled?: boolean; query?: string };
export function CustomerHierarchyTree({customer,records,customers,value="",onSelect,includeInactive=false,disabled=false,onEdit,query:externalQuery}:Props) {
  const context=useCustomerHierarchy();
  const [query,setQuery]=useState("");
  const [rootCollapsed,setRootCollapsed]=useState(false);
  const [collapsed,setCollapsed]=useState<Set<string>>(()=>new Set());
  const nodes=useMemo(()=>customerHierarchy(customer,records,customers,includeInactive),[customer,records,customers,includeInactive]);
  const counts=useMemo(()=>hierarchyCounts(customer,nodes,customers || [customer],context.orders,context.equipment),[customer,nodes,customers,context.orders,context.equipment]);
  const search=externalQuery ?? query;
  const filtered=useMemo(()=>filterHierarchy(nodes,search),[nodes,search]);
  const visible=visibleHierarchyNodes(filtered,collapsed,rootCollapsed);
  const parents=new Set(nodes.map(node=>node.parentId).filter(Boolean));
  const selection=nodes.find(node=>node.id===value && !node.issue);
  const toggle=(id:string)=>setCollapsed(current=>{const next=new Set(current);if(next.has(id))next.delete(id);else next.add(id);return next;});
  return <section className="customer-hierarchy" aria-label={`Árvore de locais de ${customer.name}`}>
    <div className="customer-hierarchy-caption">Matriz → Filial/Unidade → Setor → Ambiente</div>
    {externalQuery===undefined && <div className="customer-hierarchy-search"><Search size={14}/><input aria-label="Buscar na árvore de locais" placeholder="Buscar unidade, setor ou ambiente" value={query} onChange={event=>{setQuery(event.target.value);setRootCollapsed(false);setCollapsed(new Set());}}/></div>}
    <div className="customer-hierarchy-tools"><button type="button" onClick={()=>{setRootCollapsed(false);setCollapsed(new Set());}}>Expandir tudo</button><button type="button" onClick={()=>{setRootCollapsed(true);setCollapsed(new Set(parents));}}>Recolher tudo</button></div>
    <div className="customer-hierarchy-root"><button type="button" className="hierarchy-toggle" aria-label={`${rootCollapsed?"Expandir":"Recolher"} estrutura de ${customer.name}`} aria-expanded={!rootCollapsed} onClick={()=>setRootCollapsed(current=>!current)}>{rootCollapsed?<ChevronRight size={14}/>:<ChevronDown size={14}/>}</button><Building2 size={16}/><button type="button" disabled={disabled || !onSelect} aria-pressed={!value} onClick={()=>onSelect?.(hierarchySelection(customer,nodes))}><b>{customer.name}</b><small>Matriz · Prefeitura · {counts.get("")?.orders || 0} OS · {counts.get("")?.equipment || 0} equipamentos</small></button></div>
    <ul className="customer-hierarchy-nodes">{visible.map(node=><li key={node.id} style={{paddingLeft:Math.min(node.depth,8)*16+12}} className={node.id===value?"selected":""}>
      {parents.has(node.id)?<button type="button" className="hierarchy-toggle" aria-label={`${collapsed.has(node.id)?"Expandir":"Recolher"} ${node.name}`} aria-expanded={!collapsed.has(node.id)} onClick={()=>toggle(node.id)}>{collapsed.has(node.id)?<ChevronRight size={14}/>:<ChevronDown size={14}/>}</button>:<span className="hierarchy-toggle"/>}
      {node.kind==="room"?<MapPin size={14}/>:<Building2 size={14}/>}
      <button type="button" className="hierarchy-node-choice" disabled={disabled || !onSelect || node.issue} aria-pressed={node.id===value} onDoubleClick={()=>!disabled && !node.issue && onEdit?.(node.id)} onClick={()=>onSelect?.(hierarchySelection(customer,nodes,node.id))}><span>{node.name}</span><small>{node.kind==="unit"?"Filial/Unidade":node.kind==="sector"?"Setor":node.kind==="room"?"Ambiente":node.level}{node.issue?" · vínculo a revisar":""}{/inativ/i.test(String(node.record.status))?" · inativo":""} · {counts.get(node.id)?.orders || 0} OS · {counts.get(node.id)?.equipment || 0} equipamentos</small></button>
    </li>)}</ul>
    {!nodes.length && <p className="customer-hierarchy-empty">Nenhuma unidade cadastrada nesta Prefeitura.</p>}
    {rootCollapsed&&nodes.length>0&&<p className="customer-hierarchy-empty" role="status">Estrutura recolhida. Use Expandir tudo para exibir os locais.</p>}
    {!rootCollapsed&&nodes.length>0&&!visible.length && <p className="customer-hierarchy-empty">Nenhum local encontrado.</p>}
    {selection && <div className="customer-hierarchy-path" role="status">{hierarchySelection(customer,nodes,selection.id).path.join(" › ")}</div>}
  </section>;
}
