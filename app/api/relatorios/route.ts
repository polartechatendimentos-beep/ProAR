import { NextResponse } from "next/server";
import { db } from "@/db";
import { ordensServico } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    let list = await db.select().from(ordensServico).orderBy(desc(ordensServico.criadoEm)).limit(50);

    // Dados iniciais baseados no modelo fornecido (POLARTECH / LANDSOL)
    if (list.length === 0) {
      list = [
        {
          id: 1,
          numeroTarefa: "77756554",
          clienteNome: "LANDSOL SERVICOS E PARTICIPACOES S.A.",
          clienteCnpjCpf: "44.378.865/0001-61",
          clienteContato: "JOSE VITOR DE PAIVA",
          clienteTelefone: "(11) 9999-9999",
          clienteEmail: "email@email.com",
          equipe: "TEAM 11",
          tipoTarefa: "Higienização",
          dataAgendamento: new Date("2026-07-31T16:00:00Z"),
          checkIn: new Date("2026-07-31T15:42:00Z"),
          checkOut: new Date("2026-07-31T16:31:00Z"),
          duracao: "00:49:08",
          kmInformado: "0,00 Km",
          endereco: "Rua Rui Barbosa, 2295, Centro, Mirassol - SP, 15130-055, Brasil - sala",
          orientacao: "HIGIENIZAÇÃO DE AR CONDICIONADO",
          relatoExecucao: "Higienização completa realizada em conformidade com o checklist PMOC.",
          checklist: {
            limpezaFiltros: true,
            limpezaSerpentinaBandeja: true,
            limpezaDreno: true,
            aplicacaoBactericida: true,
            limpezaUnidadeExterna: true,
            testeFinal: true,
          },
          fotosAntes: [
            "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400",
            "https://images.unsplash.com/photo-1581094288338-2314dddb7ece?w=400"
          ],
          fotosDepois: [
            "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400"
          ],
          assinaturaTecnicoNome: "Jhonnatan",
          assinaturaTecnicoDoc: "451.467.248-30",
          assinaturaClienteNome: "Bárbara Fernandes Brito",
          assinaturaClienteDoc: "067.969.435-89",
          status: "Concluído",
          criadoEm: new Date(),
        }
      ] as any;
    }

    return NextResponse.json({ success: true, count: list.length, data: list });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newOs = await db.insert(ordensServico).values({
      numeroTarefa: body.numeroTarefa || `77${Math.floor(100000 + Math.random() * 900000)}`,
      clienteNome: body.clienteNome,
      clienteCnpjCpf: body.clienteCnpjCpf,
      clienteContato: body.clienteContato,
      clienteTelefone: body.clienteTelefone,
      clienteEmail: body.clienteEmail,
      equipe: body.equipe || "TEAM 11",
      tipoTarefa: body.tipoTarefa || "Higienização",
      dataAgendamento: body.dataAgendamento ? new Date(body.dataAgendamento) : new Date(),
      checkIn: body.checkIn ? new Date(body.checkIn) : new Date(),
      checkOut: body.checkOut ? new Date(body.checkOut) : new Date(),
      duracao: body.duracao || "00:45:00",
      kmInformado: body.kmInformado || "0,00 Km",
      endereco: body.endereco,
      orientacao: body.orientacao,
      relatoExecucao: body.relatoExecucao,
      checklist: body.checklist || {
        limpezaFiltros: true,
        limpezaSerpentinaBandeja: true,
        limpezaDreno: true,
        aplicacaoBactericida: true,
        limpezaUnidadeExterna: true,
        testeFinal: true,
      },
      fotosAntes: body.fotosAntes || [],
      fotosDepois: body.fotosDepois || [],
      assinaturaTecnicoNome: body.assinaturaTecnicoNome,
      assinaturaTecnicoDoc: body.assinaturaTecnicoDoc,
      assinaturaClienteNome: body.assinaturaClienteNome,
      assinaturaClienteDoc: body.assinaturaClienteDoc,
      status: "Concluído",
    }).returning();

    return NextResponse.json({ success: true, data: newOs[0] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
