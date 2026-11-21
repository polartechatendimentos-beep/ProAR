# ProAR 4.0 — Auditoria inicial e plano de execução das 300 melhorias
Data: 2026-11-21. Branch: `feat/proar-300-auditoria-fase1-20261121`. Não homologado. Não publicar em produção.

## Inventário verificado no código da branch main
- `components/DailyWorkCenter.tsx` e `app/page.tsx`: central do dia e navegação já existem. O painel recebia valores demonstrativos fixos (3 OS, 1 atrasada, 2 obras, 4 orçamentos etc.) e exibiu 98,2% de eficiência sem fonte comprovada. Corrigido nesta branch: métricas desconhecidas passam a mostrar traço, não zero nem dados fictícios.
- `components/ServiceOrdersSection.tsx`: módulo OS e componente `StandardDocumentReport` já integrados; verificar persistência, anexos, estoque, assinatura e acesso por empresa antes de adicionar recursos.
- `components/OrcamentoPanel.tsx`: editor já possui tipo PRODUTO/SERVIÇO em `BudgetItem`; não recriar modelo de linhas mistas sem auditar regras de persistência e tributação.
- `app/api/cron/licitacoes/route.ts`: existe rotina protegida por `CRON_SECRET`; validar origem, cobertura, idempotência, auditoria e falhas antes de ampliar fontes.
- `package.json`: `typecheck` e `test` ambos executam `tsc --noEmit`; **não há evidência de testes unitários ou integração por esse script**. Exigir testes reais antes da homologação.

## Matriz de 15 frentes (20 itens por frente; IDs conforme seleção do usuário)
| IDs | Frente | Primeiro objetivo | Dependência de aceite |
|---|---|---|---|
| 001–020 | Dashboard | Substituir métricas demonstrativas por consultas reais, escopo tenant e filtros | consultas, permissão e atualização |
| 021–040 | CRM | Auditar cadastros, hierarquia, endereços, duplicidades | migração segura e LGPD |
| 041–060 | WhatsApp/IA | Auditar conectores e consentimento; mensagens idempotentes | credenciais e canal oficial |
| 061–080 | Agenda | Auditar conflitos e disponibilidade por equipe | concorrência e fuso horário |
| 081–100 | OS | Auditar fluxo OS/itens mistos/anexos | estoque, assinatura e offline |
| 101–120 | Equipamentos | QR e histórico com autorização | privacidade e rastreabilidade |
| 121–140 | PMOC | Programação, evidências e SLA | revisão técnica |
| 141–160 | Comercial | Preservar itens mistos existentes; conversão transacional | centavos, estoque e versões |
| 161–180 | Financeiro | Conciliação e rentabilidade | idempotência contábil |
| 181–200 | Estoque | Multi-local e movimentos auditáveis | saldo e transações |
| 201–220 | Obras | Medições e materiais por unidade | consistência dos totais |
| 221–240 | Licitações | Consolidar radar e fontes verificadas | deduplicação, prazos e fonte |
| 241–260 | Fiscal | Validar fluxos NFSe/NFe/NFCe sem simular emissão | homologação fiscal |
| 261–280 | Documentos | Reutilizar trabalho do PR #286 | impressão, tenant e PDF |
| 281–300 | Plataforma | RBAC, observabilidade, testes e rollback | segurança e testes E2E |

## Execução em ondas
1. **Onda 0 — Segurança e baseline:** inventário de rotas, tabelas, credenciais por ambiente (sem expor segredos), RBAC e isolamento multiempresa; eliminar dados demonstrativos em produção; definir testes de integração.
2. **Onda 1 — Fluxos essenciais:** OS ↔ orçamento ↔ pedido ↔ estoque ↔ financeiro, com eventos idempotentes, transações e validações.
3. **Onda 2 — Operação técnica:** agenda, equipamentos, PMOC, obras e relatórios.
4. **Onda 3 — Automação:** WhatsApp oficial, IA revisada por humanos, licitações com fontes rastreáveis.
5. **Onda 4 — Fiscal e escala:** integrações fiscais homologadas, observabilidade, performance, backup e recuperação.

## Critérios de aceite e testes
- `npm run typecheck`, `npm run lint`, `npm run build`; registrar saída real, não confundir preview READY com suíte aprovada.
- Criar suíte de testes unitários e integração (scripts atuais não executam testes funcionais).
- Testar isolamento A/B entre empresas e papéis, incluindo APIs e arquivos.
- Testar falhas de rede, duplo clique, concorrência, idempotência, rollback e integridade de dados legados.
- Testar desktop/mobile, impressão A4, acessibilidade e exportação.
- Preview em Vercel e homologação por responsável autorizado antes de qualquer merge/publicação.
- Preservar modelos comerciais aprovados, fiscal legal e PR #286; evitar conflitos de branches por revisão de diff antes de merge.

## Status verificável
- [x] Branch de desenvolvimento criada a partir de main.
- [x] Inspeção inicial de cinco arquivos-chave e package.json.
- [x] Remoção de números demonstrativos do dashboard inicial.
- [ ] TypeScript, lint, build e testes funcionais: aguardando execução/verificação de CI.
- [ ] Auditoria completa dos 300 itens: pendente, por ondas.
- [ ] Homologação e publicação: não autorizadas nesta etapa.
