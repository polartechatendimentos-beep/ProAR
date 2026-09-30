"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Search, X } from "lucide-react";

export type CustomerSearchOption = {
  id: string;
  name: string;
  legalName?: string;
  tradeName?: string;
  doc?: string;
  phone?: string;
  contact?: string;
};

type Props = {
  customers: CustomerSearchOption[];
  value: string;
  onChange: (value: string, customer?: CustomerSearchOption) => void;
  valueMode?: "name" | "id";
  placeholder?: string;
  emptyValue?: string;
  emptyLabel?: string;
  disabled?: boolean;
  maxResults?: number;
  className?: string;
};

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();

export function CustomerSearchSelect({
  customers,
  value,
  onChange,
  valueMode = "name",
  placeholder = "Digite nome, CPF/CNPJ ou telefone...",
  emptyValue = "",
  emptyLabel,
  disabled = false,
  maxResults = 8,
  className = "",
}: Props) {
  const selected = customers.find(item => (valueMode === "id" ? item.id : item.name) === value);
  const [query, setQuery] = useState(selected?.name ?? (value === emptyValue ? "" : value));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const current = customers.find(item => (valueMode === "id" ? item.id : item.name) === value);
    setQuery(current?.name ?? (value === emptyValue ? "" : value));
  }, [customers, value, valueMode, emptyValue]);

  const matches = useMemo(() => {
    const term = normalize(query);
    const digits = query.replace(/\D/g, "");
    return customers
      .map(item => {
        const name = normalize(item.name);
        const legalName = normalize(item.legalName ?? "");
        const tradeName = normalize(item.tradeName ?? "");
        const contact = normalize(item.contact ?? "");
        const document = String(item.doc ?? "").replace(/\D/g, "");
        const phone = String(item.phone ?? "").replace(/\D/g, "");
        let score = term ? 0 : 1;
        if (term && name === term) score = 120;
        else if (term && name.startsWith(term)) score = 100;
        else if (term && (tradeName.startsWith(term) || legalName.startsWith(term))) score = 90;
        else if (term && (name.includes(term) || tradeName.includes(term) || legalName.includes(term))) score = 75;
        else if (digits && document.includes(digits)) score = 85;
        else if (digits && phone.includes(digits)) score = 65;
        else if (term && contact.includes(term)) score = 55;
        return { item, score };
      })
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name, "pt-BR"))
      .slice(0, maxResults)
      .map(entry => entry.item);
  }, [customers, maxResults, query]);

  const choose = (item: CustomerSearchOption) => {
    setQuery(item.name);
    setOpen(false);
    onChange(valueMode === "id" ? item.id : item.name, item);
  };

  const clear = () => {
    setQuery("");
    setOpen(true);
    onChange(emptyValue, undefined);
  };

  return <div className={`customer-search-select ${open ? "open" : ""} ${disabled ? "disabled" : ""} ${className}`}>
    <div className="customer-search-control">
      <Search size={15}/>
      <input
        value={query}
        disabled={disabled}
        autoComplete="off"
        placeholder={emptyLabel && !query ? emptyLabel : placeholder}
        onFocus={() => !disabled && setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={event => {
          setQuery(event.target.value);
          if (selected && event.target.value !== selected.name) onChange(emptyValue, undefined);
          setOpen(true);
        }}
        onKeyDown={event => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "Enter" && matches[0]) {
            event.preventDefault();
            choose(matches[0]);
          }
        }}
      />
      {query && !disabled && <button type="button" className="customer-search-clear" onMouseDown={event => event.preventDefault()} onClick={clear} aria-label="Limpar cliente"><X size={13}/></button>}
    </div>
    {open && !disabled && <div className="customer-search-results">
      {emptyLabel && <button type="button" className="customer-search-empty-option" onMouseDown={event => event.preventDefault()} onClick={() => { setQuery(""); setOpen(false); onChange(emptyValue, undefined); }}><span className="customer-search-avatar">—</span><span><b>{emptyLabel}</b><small>Continuar sem selecionar um cliente específico</small></span></button>}
      {matches.length ? matches.map(item => <button type="button" key={item.id} onMouseDown={event => event.preventDefault()} onClick={() => choose(item)}>
        <span className="customer-search-avatar">{item.name.split(" ").filter(Boolean).slice(0,2).map(part => part[0]).join("").toUpperCase()}</span>
        <span><b>{item.name}</b><small>{[item.doc, item.phone, item.contact].filter(Boolean).join(" • ") || item.legalName || item.tradeName || "Cadastro de cliente"}</small></span>
        {(valueMode === "id" ? item.id : item.name) === value && <CheckCircle2 size={15}/>}
      </button>) : <div className="customer-search-no-results"><Search size={15}/><span>Nenhum cliente encontrado</span></div>}
    </div>}
  </div>;
}
