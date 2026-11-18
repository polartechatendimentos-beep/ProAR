"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, MapPin, Search } from "lucide-react";
import {
  customerHierarchy,
  hierarchySelection,
  type HierarchyCustomer,
  type HierarchyRecord,
  type HierarchySelection,
} from "@/lib/customer-hierarchy";

type CustomerOption = HierarchyCustomer & {
  legalName?: string;
  tradeName?: string;
  doc?: string;
  phone?: string;
  address?: string;
};
type StructureOption = HierarchyRecord & { id: string; name: string; client?: string; customerId?: string; status?: string; address?: string };
type LocationOption = {
  id: string;
  name: string;
  path: string;
  address: string;
  icon: "location" | "customer";
  customer: CustomerOption;
  selection: HierarchySelection;
};
type Props = {
  customers: CustomerOption[];
  structures: StructureOption[];
  value?: string;
  disabled?: boolean;
  onSelect: (customer: CustomerOption, selection: HierarchySelection, label: string) => void;
};

const normalize = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim().toLocaleLowerCase("pt-BR");

export function CustomerLocationSearch({ customers, structures, value = "", disabled = false, onSelect }: Props) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);

  useEffect(() => setQuery(value), [value]);

  const options = useMemo(() => {
    const result: LocationOption[] = [];
    for (const customer of customers) {
      if (!customer.id || !customer.name) continue;
      const nodes = customerHierarchy(customer, structures, customers);
      const parents = new Set(nodes.map(node => node.parentId).filter(Boolean));
      for (const node of nodes) {
        if (node.issue || /inativ|cancelad/i.test(String(node.record.status || ""))) continue;
        if (!(node.kind === "unit" || node.kind === "room" || (!parents.has(node.id) && node.kind === "other"))) continue;
        const selection = hierarchySelection(customer, nodes, node.id);
        result.push({
          id: node.id,
          name: node.name,
          path: selection.path.join(" • "),
          address: selection.address || String(node.record.address || ""),
          icon: "location",
          customer,
          selection,
        });
      }
      result.push({
        id: `customer:${customer.id}`,
        name: customer.name,
        path: customer.name,
        address: String(customer.address || ""),
        icon: "customer",
        customer,
        selection: hierarchySelection(customer, nodes),
      });
    }

    const term = normalize(query);
    return result
      .map(option => {
        const name = normalize(option.name);
        const path = normalize(option.path);
        const address = normalize(option.address);
        let score = term ? 0 : option.icon === "location" ? 1 : 0;
        if (term && name === term) score = 120;
        else if (term && name.startsWith(term)) score = 105;
        else if (term && name.includes(term)) score = 90;
        else if (term && path.includes(term)) score = 80;
        else if (term && address.includes(term)) score = 65;
        else if (term && term.split(" ").filter(Boolean).every(token => path.includes(token))) score = 70;
        return { option, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || a.option.name.localeCompare(b.option.name, "pt-BR"))
      .slice(0, 10)
      .map(item => item.option);
  }, [customers, structures, query]);

  const choose = (option: LocationOption) => {
    setQuery(option.name);
    setOpen(false);
    onSelect(option.customer, option.selection, option.name);
  };

  return (
    <div className={`customer-search-select customer-location-search ${open ? "open" : ""} ${disabled ? "disabled" : ""}`}>
      <div className="customer-search-control">
        <Search size={15} aria-hidden="true" />
        <input
          aria-label="Buscar local de atendimento, unidade ou cliente"
          autoComplete="off"
          disabled={disabled}
          value={query}
          placeholder="Digite UBS, unidade, filial ou cliente..."
          onFocus={() => !disabled && setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 140)}
          onChange={event => { setQuery(event.target.value); setOpen(true); }}
          onKeyDown={event => {
            if (event.key === "Escape") setOpen(false);
            if (event.key === "Enter" && options[0]) { event.preventDefault(); choose(options[0]); }
          }}
        />
      </div>
      {open && !disabled && (
        <div className="customer-search-results">
          {options.length ? options.map(option => (
            <button type="button" key={option.id} onMouseDown={event => event.preventDefault()} onClick={() => choose(option)}>
              <span className="customer-search-avatar">{option.icon === "location" ? <MapPin size={14}/> : <Building2 size={14}/>}</span>
              <span>
                <b>{option.name}</b>
                <small>{option.icon === "location" ? option.path : "Cliente principal / endereço fiscal"}</small>
                {option.address && <small>{option.address}</small>}
              </span>
            </button>
          )) : <div className="customer-search-no-results"><Search size={15}/><span>Nenhum local ou cliente encontrado</span></div>}
        </div>
      )}
    </div>
  );
}
