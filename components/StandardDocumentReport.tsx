"use client";

import React, { useState, useEffect } from "react";
import { Printer, X, Download, Check, ShieldCheck, Wrench, Building2, Phone, Mail, Globe, MapPin } from "lucide-react";

export interface ReportItem {
  itemNum: string;
  equipamentoOuItem: string;
  capacidadeOuDetalhes?: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface CompanyData {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual?: string;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
  whatsapp?: string;
  email?: string;
  site?: string;
  slogan?: string;
  logoUrl?: string;
  responsavelTecnico?: string;
}

export interface ClientData {
  nome: string;
  cnpjCpf?: string;
  contato?: string;
  telefone?: string;
  email?: string;
  endereco: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
}

export interface StandardDocumentProps {
  tipo: "ORCAMENTO" | "ORDEM_SERVICO" | "PEDIDO";
  numero: string;
  data?: string;
  cliente: ClientData;
  empresaProp?: Partial<CompanyData>;
  descricaoServico?: string;
  itens: ReportItem[];
  valorGlobal?: number;
  valorGlobalExtenso?: string;
  escopoCards?: Array<{
    titulo: string;
    itens: string[];
  }>;
  condicoesComerciais?: {
    formaPagamento?: string;
    validade?: string;
    garantia?: string;
    prazo?: string;
  };
  itensInclusos?: string[];
  itensNaoInclusos?: string[];
  assinaturas?: {
    clienteNome?: string;
    clienteResponsavel?: string;
    clienteDoc?: string;
    tecnicoNome?: string;
    tecnicoDoc?: string;
  };
  onClose?: () => void;
}

export function StandardDocumentReport({
  tipo = "ORCAMENTO",
  numero,
  data,
  cliente,
  empresaProp,
  descricaoServico,
  itens,
  valorGlobal,
  valorGlobalExtenso,
  escopoCards,
  condicoesComerciais,
  itensInclusos,
  itensNaoInclusos,
  assinaturas,
  onClose,
}: StandardDocumentProps) {
  const [empresa, setEmpresa] = useState<CompanyData>({
    razaoSocial: "PolarTech Mirassol Ar Condicionado Ltda.",
    nomeFantasia: "POLARTECH AR CONDICIONADO",
    cnpj: "44.378.865/0001-61",
    inscricaoEstadual: "451.467.248.110",
    endereco: "Rua São Pedro, 2184",
    bairro: "Centro",
    cidade: "Mirassol",
    uf: "SP",
    cep: "15130-000",
    telefone: "(17) 2122-2806",
    whatsapp: "(17) 99156-7798",
    email: "contato@polartechsolucoes.com.br",
    site: "polartechsolucoes.com.br",
    slogan: "Mais conforto, mais qualidade de vida!",
    responsavelTecnico: "Engenheiro Mecânico Responsável Técnico (CREA-SP)",
    ...empresaProp,
  });

  // Busca dados dinâmicos da empresa via API se não passados
  useEffect(() => {
    async function loadCompany() {
      try {
        const res = await fetch("/api/fiscal-config");
        const json = await res.json();
        if (json.success && json.data) {
          setEmpresa((prev) => ({
            ...prev,
            ...json.data,
            ...empresaProp,
          }));
        }
      } catch (e) {
        // Fallback já definido
      }
    }
    loadCompany();
  }, [empresaProp]);

  const totalCalculado = valorGlobal !== undefined 
    ? valorGlobal 
    : itens.reduce((acc, i) => acc + i.valorTotal, 0);

  const documentTitle = tipo === "ORCAMENTO" 
    ? "ORÇAMENTO - SERVIÇO DE CLIMATIZAÇÃO & PMOC" 
    : tipo === "ORDEM_SERVICO" 
    ? "ORDEM DE SERVIÇO & LAUDO TÉCNICO PMOC" 
    : "PEDIDO DE VENDA & FORNECIMENTO";

  const documentNumberLabel = tipo === "ORCAMENTO" 
    ? "ORÇAMENTO Nº:" 
    : tipo === "ORDEM_SERVICO" 
    ? "ORDEM DE SERVIÇO Nº:" 
    : "PEDIDO Nº:";

  const defaultDescricao = descricaoServico || (
    tipo === "ORCAMENTO"
      ? "Execução de serviço especializado de higienização, manutenção preventiva e adequação de sistemas de ar-condicionado, visando garantir a eficiência térmica, conservação dos compressores e a qualidade do ar conforme as normas vigentes."
      : tipo === "ORDEM_SERVICO"
      ? "Atendimento técnico presencial executado conforme checklist PMOC, com aplicação de produtos bactericidas biodegradáveis registrados no Ministério da Saúde e testes operacionais de rendimento e estanqueidade."
      : "Fornecimento de equipamentos, peças e insumos com garantia de fábrica e procedência técnica para sistemas de climatização."
  );

  const defaultEscopo = escopoCards || [
    {
      titulo: "SERPENTINA (UNIDADE INTERNA)",
      itens: ["Limpeza e higienização química profunda da serpentina e aletas."],
    },
    {
      titulo: "BANDEJA DE CONDENSADO",
      itens: ["Desincrustação, lavagem e assepsia da bandeja de condensado."],
    },
    {
      titulo: "TURBINA (VENTILADOR)",
      itens: ["Limpeza da turbina e do conjunto de ventilação tangencial."],
    },
    {
      titulo: "DRENO",
      itens: ["Verificação, desobstrução e lavagem da linha de drenagem."],
    },
    {
      titulo: "PRODUTOS E PROCEDIMENTOS",
      itens: [
        "Aplicação de bactericida biodegradável registrado no MS;",
        "Higienização conforme Portaria 3.523 e ANVISA RE nº 09.",
      ],
    },
  ];

  const defaultInclusos = itensInclusos || [
    "Mão de obra técnica especializada com EPIs e ferramentas certificadas;",
    "Produtos de higienização bactericida com laudo do Ministério da Saúde;",
    "Limpeza completa de serpentina, bandeja de condensado, turbina e dreno;",
    "Emissão de relatório / checklist técnico do serviço;",
    "Deslocamento da equipe técnica.",
  ];

  const defaultNaoInclusos = itensNaoInclusos || [
    "Recarga de gás refrigerante (caso não contratada nesta proposta);",
    "Reparo de vazamentos ocultos na tubulação estrutural;",
    "Troca de peças, placas eletrônicas e compressores;",
    "Infraestrutura de ponto elétrico e disjuntores da edificação;",
    "Serviços de alvenaria, pintura ou gesso civil;",
    "Outros serviços não discriminados formalmente nesta proposta.",
  ];

  const dataAtualFormatada = data || new Date().toLocaleDateString("pt-BR");

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm overflow-y-auto flex justify-center p-2 sm:p-4 print:p-0 print:static print:bg-white">
      {/* Botões de Ação Flutuantes */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2 print:hidden">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg transition flex items-center gap-1.5"
        >
          <Printer className="w-4 h-4" /> Imprimir Documento (A4)
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl shadow-lg transition"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Folha A4 Padronizada */}
      <div className="bg-white w-full max-w-[210mm] min-h-[297mm] p-6 sm:p-8 rounded-2xl shadow-2xl print:shadow-none print:rounded-none print:p-6 text-slate-900 font-sans text-xs flex flex-col justify-between my-4 print:my-0 border border-slate-200 print:border-none">
        
        <div className="space-y-4">
          {/* ============================================================== */}
          {/* CABEÇALHO PADRÃO POLARTECH / PROAR (CAPTADO DINAMICAMENTE)     */}
          {/* ============================================================== */}
          <header className="border-b-2 border-blue-900 pb-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              
              {/* Lado Esquerdo: Logo e Especialidades da Empresa */}
              <div className="flex items-center gap-3">
                {empresa.logoUrl ? (
                  <img src={empresa.logoUrl} alt={empresa.nomeFantasia} className="h-16 w-auto object-contain" />
                ) : (
                  /* Logo Estilizado Vetorial Idêntico ao Modelo PolarTech */
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-700 via-blue-600 to-sky-400 flex items-center justify-center text-white font-black text-2xl shadow-sm border border-blue-800 shrink-0">
                      ❄
                    </div>
                    <div>
                      <div className="text-xl font-black tracking-tight text-blue-900 uppercase font-sans">
                        {empresa.nomeFantasia || "POLARTECH"}
                      </div>
                      <div className="text-[10px] tracking-widest text-sky-700 font-bold uppercase font-mono">
                        AR CONDICIONADO & CLIMATIZAÇÃO
                      </div>
                      <div className="text-[9px] text-slate-500 font-medium tracking-tight">
                        MANUTENÇÃO PREVENTIVA E CORRETIVA • HIGIENIZAÇÃO • PMOC • INSTALAÇÃO
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Lado Direito: Box de Identificação e Número do Documento */}
              <div className="border border-blue-900 bg-blue-50/40 rounded-xl p-3 text-right shrink-0 min-w-[200px]">
                <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider block">
                  {documentNumberLabel}
                </span>
                <span className="text-lg font-black text-blue-950 font-mono block">
                  {numero}
                </span>
                <span className="text-[10px] text-slate-600 font-bold block mt-0.5">
                  DATA: {dataAtualFormatada}
                </span>
              </div>
            </div>

            {/* Faixa com Título do Documento */}
            <div className="mt-3 bg-blue-900 text-white font-bold text-xs uppercase px-3 py-1.5 rounded-lg tracking-wider text-center">
              {documentTitle}
            </div>

            {/* Dados do Cliente e Local de Atendimento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px]">
              <div>
                <span className="font-bold text-blue-950 block text-[10px] uppercase">CLIENTE:</span>
                <span className="font-bold text-slate-900 block text-xs">{cliente.nome}</span>
                {cliente.cnpjCpf && (
                  <span className="text-slate-600 block">CNPJ/CPF: {cliente.cnpjCpf}</span>
                )}
                {cliente.contato && (
                  <span className="text-slate-600 block">Contato: {cliente.contato}</span>
                )}
                {cliente.telefone && (
                  <span className="text-slate-600 block">Telefone: {cliente.telefone}</span>
                )}
              </div>
              <div>
                <span className="font-bold text-blue-950 block text-[10px] uppercase">ENDEREÇO DE ATENDIMENTO:</span>
                <span className="text-slate-800 font-medium block leading-snug">{cliente.endereco}</span>
                <span className="text-slate-600 block">
                  {cliente.cidade || "Mirassol"} - {cliente.uf || "SP"} {cliente.cep ? `• CEP ${cliente.cep}` : ""}
                </span>
              </div>
            </div>
          </header>

          {/* ============================================================== */}
          {/* 1. DESCRIÇÃO DO SERVIÇO / OBJETIVO                              */}
          {/* ============================================================== */}
          <section>
            <h3 className="text-xs font-black text-blue-900 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-blue-900 text-white flex items-center justify-center text-[10px]">1</span>
              DESCRIÇÃO DO SERVIÇO
            </h3>
            <div className="p-3 bg-white border border-slate-200 rounded-xl text-slate-700 leading-relaxed text-[11px]">
              {defaultDescricao}
            </div>
          </section>

          {/* ============================================================== */}
          {/* 2. EQUIPAMENTOS CONTEMPLADOS / ITENS                            */}
          {/* ============================================================== */}
          <section>
            <h3 className="text-xs font-black text-blue-900 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-blue-900 text-white flex items-center justify-center text-[10px]">2</span>
              EQUIPAMENTOS CONTEMPLADOS & ESPECIFICAÇÃO
            </h3>
            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-blue-900 text-white font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-2 w-12 text-center">ITEM</th>
                    <th className="p-2">EQUIPAMENTO / SERVIÇO</th>
                    <th className="p-2">CAPACIDADE / POTÊNCIA</th>
                    <th className="p-2 w-16 text-center">QTD</th>
                    <th className="p-2 w-24 text-right">VALOR UNIT.</th>
                    <th className="p-2 w-24 text-right">VALOR TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {itens.map((it, idx) => (
                    <tr key={idx} className={idx % 2 === 1 ? "bg-slate-50/60" : "bg-white"}>
                      <td className="p-2 text-center font-bold text-slate-500 font-mono">
                        {it.itemNum || String(idx + 1).padStart(2, "0")}
                      </td>
                      <td className="p-2 font-bold text-slate-900">{it.equipamentoOuItem}</td>
                      <td className="p-2 text-slate-600 font-medium">{it.capacidadeOuDetalhes || "-"}</td>
                      <td className="p-2 text-center font-mono font-bold">{it.quantidade}</td>
                      <td className="p-2 text-right font-mono">
                        R$ {it.valorUnitario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-slate-900">
                        R$ {it.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {/* Linha de Total */}
                  <tr className="bg-blue-50/80 font-black text-slate-900 border-t-2 border-blue-900">
                    <td colSpan={4} className="p-2.5 text-right font-sans uppercase text-[10px] text-blue-950">
                      VALOR TOTAL DO SERVIÇO:
                    </td>
                    <td colSpan={2} className="p-2.5 text-right font-mono text-sm text-blue-900">
                      R$ {totalCalculado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ============================================================== */}
          {/* 3. ESCOPO DA HIGIENIZAÇÃO / CHECKLIST TÉCNICO (5 CARDS)         */}
          {/* ============================================================== */}
          <section>
            <h3 className="text-xs font-black text-blue-900 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-blue-900 text-white flex items-center justify-center text-[10px]">3</span>
              ESCOPO DA HIGIENIZAÇÃO & PROCEDIMENTOS TÉCNICOS
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {defaultEscopo.map((c, i) => (
                <div key={i} className="border border-blue-200 bg-blue-50/30 rounded-xl p-2.5 flex flex-col justify-between text-[10px]">
                  <div>
                    <span className="font-black text-blue-950 block text-[9px] uppercase tracking-tight mb-1 border-b border-blue-200 pb-1">
                      {c.titulo}
                    </span>
                    <ul className="space-y-1 text-slate-700 leading-tight">
                      {c.itens.map((li, j) => (
                        <li key={j} className="flex items-start gap-1">
                          <span className="text-blue-600 font-bold">•</span>
                          <span>{li}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ============================================================== */}
          {/* 4. INVESTIMENTO / VALOR GLOBAL                                 */}
          {/* ============================================================== */}
          <section className="border border-blue-900 bg-gradient-to-r from-blue-900/5 via-blue-50/30 to-sky-50/20 rounded-xl p-3.5 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="space-y-1 max-w-lg">
              <span className="text-[10px] font-black uppercase text-blue-950 tracking-wider block">
                4. INVESTIMENTO — VALOR GLOBAL DO SERVIÇO
              </span>
              <p className="text-[11px] text-slate-700 leading-snug">
                Utilizamos produtos de alta performance com ação bactericida e fungicida registrados no Ministério da Saúde, garantindo máxima eficiência térmica e qualidade do ar de interiores.
              </p>
            </div>
            <div className="bg-white border-2 border-blue-900 rounded-xl p-3 text-center min-w-[210px] shadow-sm shrink-0">
              <span className="text-xl font-black text-blue-950 font-mono block">
                R$ {totalCalculado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-slate-600 italic block font-medium">
                {valorGlobalExtenso || "(valor líquido conforme itens e serviços acima)"}
              </span>
            </div>
          </section>

          {/* ============================================================== */}
          {/* 5. CONDIÇÕES COMERCIAIS & 6. O QUE ESTÁ INCLUSO                */}
          {/* ============================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 6. O que está incluso */}
            <section className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
              <h4 className="text-[11px] font-black text-blue-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-blue-900 text-white flex items-center justify-center text-[9px]">5</span>
                O QUE ESTÁ INCLUSO NO VALOR
              </h4>
              <ul className="space-y-1 text-[10px] text-slate-700">
                {defaultInclusos.map((inc, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{inc}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* 5. Condições comerciais */}
            <section className="border border-slate-200 rounded-xl p-3 bg-slate-50/50">
              <h4 className="text-[11px] font-black text-blue-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded bg-blue-900 text-white flex items-center justify-center text-[9px]">6</span>
                CONDIÇÕES COMERCIAIS
              </h4>
              <div className="space-y-1 text-[10px] text-slate-700 leading-tight">
                <div><strong>Forma de pagamento:</strong> {condicoesComerciais?.formaPagamento || "A combinar / PIX / Faturado em até 15 dias"}</div>
                <div><strong>Validade da proposta:</strong> {condicoesComerciais?.validade || "10 (dez) dias úteis"}</div>
                <div><strong>Garantia do serviço:</strong> {condicoesComerciais?.garantia || "90 (noventa) dias para mão de obra e serviços executados (CDC)"}</div>
                <div><strong>Prazo de execução:</strong> {condicoesComerciais?.prazo || "A combinar conforme escala técnica da equipe"}</div>
              </div>
            </section>
          </div>

          {/* ============================================================== */}
          {/* 7. IMPORTANTE / NÃO CONTEMPLA                                  */}
          {/* ============================================================== */}
          <section className="border border-rose-200 bg-rose-50/30 rounded-xl p-2.5 text-[10px]">
            <span className="font-bold text-rose-900 uppercase block text-[9px] mb-1">
              7. IMPORTANTE — ESTE SERVIÇO NÃO CONTEMPLA:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 text-slate-600">
              {defaultNaoInclusos.map((nao, i) => (
                <div key={i} className="flex items-center gap-1 text-slate-700">
                  <span className="text-rose-600 font-bold font-mono">✕</span>
                  <span>{nao}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ============================================================== */}
          {/* 8. ACEITE DO CLIENTE & 9. RESPONSÁVEL TÉCNICO (ASSINATURAS)    */}
          {/* ============================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {/* Aceite do Cliente */}
            <div className="border border-slate-300 rounded-xl p-3 bg-white space-y-3">
              <span className="font-bold text-blue-950 uppercase block text-[10px] border-b pb-1">
                8. ACEITE DO CLIENTE / TOMADOR DO SERVIÇO
              </span>
              <p className="text-[9px] text-slate-500 leading-tight">
                De acordo com as condições comerciais e técnicas apresentadas, autorizo formalmente a execução dos serviços especificados.
              </p>
              <div className="pt-4 text-center">
                <div className="border-t border-slate-400 w-3/4 mx-auto mb-1"></div>
                <span className="font-bold text-slate-800 text-[10px] block">{cliente.nome}</span>
                <span className="text-[9px] text-slate-500 block">Nome do Responsável / CPF: ____________________</span>
                <span className="text-[9px] text-slate-400 block mt-1">Data: ____/____/________</span>
              </div>
            </div>

            {/* Responsável Técnico da Empresa */}
            <div className="border border-slate-300 rounded-xl p-3 bg-white space-y-3">
              <span className="font-bold text-blue-950 uppercase block text-[10px] border-b pb-1">
                9. RESPONSABILIDADE TÉCNICA (EMPRESA)
              </span>
              <p className="text-[9px] text-slate-500 leading-tight">
                Serviços inspecionados em estrita conformidade com as normas ABNT NBR 13971 e legislação sanitária vigente.
              </p>
              <div className="pt-4 text-center">
                <div className="border-t border-slate-400 w-3/4 mx-auto mb-1"></div>
                <span className="font-bold text-slate-800 text-[10px] block">{empresa.razaoSocial}</span>
                <span className="text-[9px] text-slate-500 block">
                  {empresa.responsavelTecnico || "Engenheiro Responsável Técnico • CREA-SP Ativo"}
                </span>
                <span className="text-[9px] text-slate-400 block mt-1">Data: ____/____/________</span>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* RODAPÉ CORPORATIVO (CAPTADO DINAMICAMENTE DO CADASTRO)         */}
        {/* ============================================================== */}
        <footer className="border-t-2 border-blue-900 pt-3 mt-4 text-[10px] text-slate-600">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-center sm:text-left">
            <div>
              <span className="font-bold text-slate-900 block text-[11px]">{empresa.razaoSocial}</span>
              <span className="block">
                {empresa.endereco}, {empresa.bairro} • {empresa.cidade}-{empresa.uf} • CEP {empresa.cep}
              </span>
            </div>
            <div className="text-center sm:text-right">
              <span className="font-bold text-blue-900 block">
                {empresa.telefone} {empresa.whatsapp ? `• WhatsApp: ${empresa.whatsapp}` : ""}
              </span>
              <span className="block text-slate-500 font-mono">
                {empresa.site} {empresa.email ? `• ${empresa.email}` : ""}
              </span>
            </div>
          </div>

          <div className="mt-2 text-center text-blue-950 font-bold italic tracking-wide text-[10px] border-t border-slate-100 pt-1">
            "{empresa.slogan || "Mais conforto, mais qualidade de vida!"}"
          </div>
        </footer>

      </div>
    </div>
  );
}
