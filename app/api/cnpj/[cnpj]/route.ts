import { NextResponse } from "next/server";
import { validCnpj } from "../../../../lib/document-validation";

export const dynamic = "force-dynamic";

type NormalizedCnpj = {
  cnpj: string; legalName: string; tradeName: string; email: string; phone: string;
  zipCode: string; street: string; addressNumber: string; complement: string;
  neighborhood: string; city: string; state: string; stateRegistration: string;
  cnaeMain: string; taxStatus: string; source: string;
};

async function jsonFetch(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal, headers: { Accept: "application/json", "User-Agent": "ProAR-Gestao-de-Servicos/1.0" } });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  } finally { clearTimeout(timeout); }
}

async function brasilApi(cnpj: string): Promise<NormalizedCnpj | null> {
  try {
    const { response, data } = await jsonFetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (!response.ok || !data?.razao_social) return null;
    return {
      cnpj, legalName:data.razao_social||"", tradeName:data.nome_fantasia||data.razao_social||"",
      email:data.email||"", phone:data.ddd_telefone_1||"", zipCode:String(data.cep||""),
      street:data.logradouro||"", addressNumber:data.numero||"", complement:data.complemento||"",
      neighborhood:data.bairro||"", city:data.municipio||"", state:data.uf||"", stateRegistration:"",
      cnaeMain:[data.cnae_fiscal,data.cnae_fiscal_descricao].filter(Boolean).join(" - "),
      taxStatus:data.descricao_situacao_cadastral||"", source:"BrasilAPI",
    };
  } catch { return null; }
}

async function openCnpj(cnpj: string): Promise<NormalizedCnpj | null> {
  try {
    const { response, data } = await jsonFetch(`https://api.opencnpj.org/${cnpj}`);
    if (!response.ok) return null;
    const legalName=data.razao_social||data.razaoSocial||data.company?.name||"";
    if (!legalName) return null;
    const address=data.endereco||data.address||{};
    return {
      cnpj, legalName, tradeName:data.nome_fantasia||data.nomeFantasia||data.fantasia||legalName,
      email:data.email||data.estabelecimento?.email||"", phone:data.telefone||data.estabelecimento?.telefone1||"",
      zipCode:String(data.cep||address.cep||""), street:data.logradouro||address.logradouro||address.street||"",
      addressNumber:String(data.numero||address.numero||address.number||""), complement:data.complemento||address.complemento||"",
      neighborhood:data.bairro||address.bairro||address.district||"", city:data.municipio||address.municipio||address.city||"",
      state:data.uf||address.uf||address.state||"", stateRegistration:"",
      cnaeMain:String(data.cnae_principal||data.cnaePrincipal||""), taxStatus:data.situacao_cadastral||data.situacaoCadastral||"",
      source:"OpenCNPJ",
    };
  } catch { return null; }
}

export async function GET(_: Request, context: { params: Promise<{ cnpj: string }> }) {
  const { cnpj: raw } = await context.params;
  const cnpj = raw.replace(/\D/g, "");
  if (!validCnpj(cnpj)) return NextResponse.json({ error: "CNPJ inválido. Verifique os dígitos informados." }, { status: 400 });
  const result = await brasilApi(cnpj) || await openCnpj(cnpj);
  if (!result) return NextResponse.json({ error: "Consulta automática indisponível no momento. O cadastro continua liberado para preenchimento manual." }, { status: 503 });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
