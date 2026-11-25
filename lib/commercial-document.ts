export interface QuoteConversionItem {
  id: string;
  tipo: "PRODUTO" | "SERVIÇO";
  descricao: string;
  unidade?: string;
  quantidade: number;
  valorUnitario: number;
  desconto: number;
  valorTotal: number;
}

export interface QuoteConversionDraft {
  id: string;
  numero: string;
  cliente: string;
  cnpjCpf: string;
  cidade: string;
  itens: QuoteConversionItem[];
  valorTotal: number;
  createdAt: string;
}
