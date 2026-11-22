# Auditoria operacional ProAR — levantamento inicial (12/11/2026)

## Escopo e evidências
- Produção Vercel READY no commit `a639a472b6f3e08d3a0197a9b7dce2b937f4dd30` (#203).
- PRs #205–#212 abertos e não incorporados à produção, incluindo mudanças concorrentes em `app/page.tsx` e `app/globals.css`.
- GitHub Actions `Validar ProAR` dos PRs #211 e #212 concluído com sucesso. Isso não substitui testes de ponta a ponta em ambiente com dados representativos.
- Verificação estática dos caminhos `app/page.tsx`, `lib/service-order-receipt-pdf.ts`, `lib/mobile-order-records.ts`, `package.json`, `tests/run.mjs`.
- Não foram realizados testes autenticados de produção, consultas ao banco real, envio WhatsApp ou emissão fiscal; não classificar suspeitas como defeitos confirmados.

## Achados
| ID | Severidade | Evidência | Risco | Tratamento |
| --- | --- | --- | --- | --- |
| A01 | Alta | `ContextReports.generate` em `app/page.tsx` executa `window.print()` para diferentes opções de relatório; `quickPrintServiceOrder` gera PDF específico. | Ações de relatório distintas podem imprimir a mesma tela em vez de documentos diferentes. | Substituir menu genérico por geradores específicos, consolidando #211 após teste. |
| A02 | Alta | PRs #205, #207, #208, #209 e #210 alteram arquivos monolíticos compartilhados a partir de `production`. | Conflitos, sobrescritas e regressões se mesclados sem integração sequencial. | Branch de integração, merge/rebase sequencial, revisão de diff, CI e E2E. |
| A03 | Média | PRs #204 e #205 abordam abertura/edição e visualização de OS com escopo sobreposto. | Fluxos e componentes duplicados. | Comparar recursos e escolher implementação canônica antes de merge. |
| A04 | Alta | #211 e #212 têm CI aprovado mas funções de validação do #212 não estão ligadas às rotas/formulários. | Aprovação de CI não comprova funcionamento operacional. | Conectar validações ao backend e UI, testar persistência e isolamento. |
| A05 | Média | Gerador `service-order-receipt-pdf.ts` recebe `receipt.service` como texto simples na versão de produção. | Quantidades de serviços diferentes podem não aparecer discriminadas no PDF atual. | Usar itens estruturados do registro autorizado e conferir subtotais com OS reais. |
| A06 | Média | Em `lib/mobile-order-records.ts`, `fieldCustomerHistory` filtra pelo `customerId`; `serviceOrderDocumentData` aceita objeto previamente autorizado. | Fluxos sem customerId e inconsistências de vínculo precisam de testes de autorização e migração. | Verificar vínculos legados, RBAC e isolamento por tenant. |

## Matriz de homologação exigida
1. Login, perfis, RBAC, isolamento entre empresas, logs e permissões.
2. Clientes: CPF/CNPJ, CEP, endereços, unidades, setores, salas, duplicidade e persistência.
3. OS: criar, editar, serviços 2+2+2, quantidades, descontos, preços, equipamentos, técnico, agenda, checklist, fotos, assinatura, concluir e reabrir.
4. Relatórios: três variantes, preview, PDF por ID, paginação, assinaturas e consistência com banco.
5. Agenda: sobreposição, conflitos, disponibilidade, filtros, status e sincronização com OS.
6. Estoque/compras: entradas, saídas, reservas, baixa por OS, estorno e idempotência.
7. Financeiro/PDV: recebimentos, pagamentos, descontos, taxas, estorno, conciliação e dupla cobrança.
8. PMOC: contratos, recorrência, execução, certificado, vencimentos e duplicação de agendamentos.
9. Fiscal: DPS/NFS-e nacional, assinatura, envio, consulta, idempotência, rejeição e reprocessamento.
10. Licitações: radar, documentos, auditoria, checklist, alertas, anexos e permissões.
11. Atendimento/WhatsApp: filas, histórico, duplicação de mensagens, confirmação e opt-in.
12. Obras: quadras/casas, estados, cálculo de progresso e cache do link público.
13. Mobile: offline, fila de sincronização, conflitos, anexos, reenvio e idempotência.

## Critérios de liberação
- CI completo, incluindo build, aprovado no commit integrado.
- Testes de integração/E2E dos fluxos críticos em homologação, sem dados reais modificados.
- Verificação de autorização por tenant e controle de idempotência para operações financeiras, fiscais e de mensagens.
- Aprovação explícita da homologação, merge controlado e Vercel READY.
- Plano de rollback e verificação de logs após publicação.

**Estado:** auditoria preliminar de código e pipeline; não é laudo de ausência de bugs nem aprovação para produção.
