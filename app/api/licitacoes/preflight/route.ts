import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { licitacaoChecklistItems, licitacaoDocuments, licitacoes } from "@/db/schema";
import { getEffectiveCompanyId } from "@/lib/company-access";
import { readSession } from "@/lib/proar-auth";

type CheckStatus = "PASS" | "WARNING" | "BLOCKER" | "NOT_APPLICABLE";
type Check = { code: string; status: CheckStatus; origin: string; message: string; correctiveAction: string };

export async function POST(request: Request) {
  try {
    const session = await readSession(request);
    if (!session) return NextResponse.json({ success: false, error: "Não autorizado." }, { status: 401 });
    const body = await request.json();
    const licitacaoId = Number(body.licitacaoId);
    if (!Number.isInteger(licitacaoId) || licitacaoId <= 0) {
      return NextResponse.json({ success: false, error: "Informe uma licitação válida." }, { status: 400 });
    }
    const companyId = getEffectiveCompanyId(session, body.companyId ? Number(body.companyId) : null);
    const [licitacao] = await db.select().from(licitacoes)
      .where(and(eq(licitacoes.id, licitacaoId), eq(licitacoes.companyId, companyId))).limit(1);
    if (!licitacao) return NextResponse.json({ success: false, error: "Licitação não encontrada." }, { status: 404 });

    const [checklist, documents] = await Promise.all([
      db.select().from(licitacaoChecklistItems).where(and(eq(licitacaoChecklistItems.companyId, companyId), eq(licitacaoChecklistItems.licitacaoId, licitacaoId))),
      db.select().from(licitacaoDocuments).where(and(eq(licitacaoDocuments.companyId, companyId), eq(licitacaoDocuments.licitacaoId, licitacaoId))),
    ]);
    const checks: Check[] = [];
    checks.push(licitacao.linkEdital
      ? { code: "EDITAL_LINK", status: "PASS", origin: "Cadastro da licitação", message: "Link do edital informado.", correctiveAction: "Nenhuma ação necessária." }
      : { code: "EDITAL_LINK", status: "BLOCKER", origin: "Cadastro da licitação", message: "O edital ainda não está vinculado ao processo.", correctiveAction: "Informe o link oficial do edital." });

    if (!checklist.length) {
      checks.push({ code: "CHECKLIST", status: "BLOCKER", origin: "Matriz de atendimento", message: "Nenhuma exigência do edital foi cadastrada para conferência.", correctiveAction: "Leia o edital e adicione os requisitos de habilitação, proposta e prazos à matriz." });
    } else {
      const pending = checklist.filter(item => item.status !== "atendido");
      checks.push(pending.length === 0
        ? { code: "CHECKLIST", status: "PASS", origin: "Matriz de atendimento", message: `${checklist.length} exigência(s) marcada(s) como atendida(s).`, correctiveAction: "Nenhuma ação necessária." }
        : { code: "CHECKLIST", status: "BLOCKER", origin: "Matriz de atendimento", message: `${pending.length} de ${checklist.length} exigência(s) ainda precisa(m) de revisão.`, correctiveAction: "Revise cada requisito, associe a evidência e atualize o atendimento." });
    }

    if (!documents.length) {
      checks.push({ code: "DOCUMENTS", status: "BLOCKER", origin: "Dossiê documental", message: "Nenhum documento foi vinculado a esta licitação.", correctiveAction: "Inclua as certidões e demais documentos exigidos pelo edital." });
    } else {
      const missingEvidence = documents.filter(document => !document.arquivoUrl);
      checks.push(missingEvidence.length === 0
        ? { code: "DOCUMENT_EVIDENCE", status: "PASS", origin: "Dossiê documental", message: "Todos os documentos têm uma evidência vinculada.", correctiveAction: "Nenhuma ação necessária." }
        : { code: "DOCUMENT_EVIDENCE", status: "BLOCKER", origin: "Dossiê documental", message: `${missingEvidence.length} documento(s) sem link de evidência.`, correctiveAction: "Vincule o arquivo correspondente a cada documento." });

      const now = Date.now();
      const invalid = documents.filter(document => !document.validade || new Date(document.validade).getTime() < now);
      checks.push(invalid.length === 0
        ? { code: "DOCUMENT_VALIDITY", status: "PASS", origin: "Validade cadastrada", message: "As validades informadas estão dentro do prazo.", correctiveAction: "Confira se as datas correspondem aos documentos originais." }
        : { code: "DOCUMENT_VALIDITY", status: "BLOCKER", origin: "Validade cadastrada", message: `${invalid.length} documento(s) vencido(s) ou sem data de validade.`, correctiveAction: "Renove os documentos vencidos e informe a validade dos demais." });

      const notApproved = documents.filter(document => document.situacao !== "aprovado");
      checks.push(notApproved.length === 0
        ? { code: "DOCUMENT_REVIEW", status: "PASS", origin: "Revisão do dossiê", message: "Todos os documentos vinculados foram aprovados por um responsável.", correctiveAction: "Nenhuma ação necessária." }
        : { code: "DOCUMENT_REVIEW", status: "BLOCKER", origin: "Revisão do dossiê", message: `${notApproved.length} documento(s) ainda não foram aprovados.`, correctiveAction: "Abra cada evidência, confira os dados e registre a aprovação." });

      const inconsistentCnpj = new Set(documents.map(document => document.cnpj.replace(/\D/g, "")).filter(Boolean)).size > 1;
      checks.push(inconsistentCnpj
        ? { code: "CNPJ_CONSISTENCY", status: "WARNING", origin: "Dados dos documentos", message: "Foram encontrados CNPJs diferentes no dossiê.", correctiveAction: "Confirme se pertencem à licitante ou a empresas autorizadas no edital." }
        : { code: "CNPJ_CONSISTENCY", status: "PASS", origin: "Dados dos documentos", message: "Os CNPJs cadastrados não apresentam divergência entre si.", correctiveAction: "Nenhuma ação necessária." });
    }

    const proposalDeadline = licitacao.dataFimProposta ? new Date(licitacao.dataFimProposta).getTime() : null;
    checks.push(proposalDeadline === null
      ? { code: "PROPOSAL_DEADLINE", status: "WARNING", origin: "Cadastro da licitação", message: "O encerramento do prazo para propostas não foi informado.", correctiveAction: "Confira o edital e cadastre a data e hora limite." }
      : proposalDeadline < Date.now()
        ? { code: "PROPOSAL_DEADLINE", status: "BLOCKER", origin: "Cadastro da licitação", message: "O prazo final de propostas já passou.", correctiveAction: "Confirme no portal oficial se houve prorrogação ou nova sessão." }
        : { code: "PROPOSAL_DEADLINE", status: "PASS", origin: "Cadastro da licitação", message: "O prazo final de propostas ainda não passou.", correctiveAction: "Acompanhe eventuais retificações no portal oficial." });

    checks.push({ code: "PROPOSAL_STRUCTURE", status: "BLOCKER", origin: "Módulo de propostas", message: "A proposta comercial ainda não possui itens, custos e totais estruturados neste processo.", correctiveAction: "Conclua a conferência comercial fora deste módulo e só considere o envio após revisão da proposta." });

    const summary = {
      passed: checks.filter(check => check.status === "PASS").length,
      warnings: checks.filter(check => check.status === "WARNING").length,
      blockers: checks.filter(check => check.status === "BLOCKER").length,
      notApplicable: checks.filter(check => check.status === "NOT_APPLICABLE").length,
    };
    return NextResponse.json({
      success: true,
      data: { readyToSubmit: summary.blockers === 0, calculatedAt: new Date().toISOString(), summary, checks, dryRun: true },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Não foi possível executar a auditoria pré-envio." }, { status: 500 });
  }
}
