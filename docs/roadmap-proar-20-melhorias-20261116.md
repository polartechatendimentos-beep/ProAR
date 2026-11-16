# ProAR — plano aprovado de 20 melhorias e critérios de homologação

Autorização: 16/11/2026. Escopo exclusivo ProAR (não alterar ProBarber).

## Etapa 1 — Estabilidade e identificação de vendedor
1. Central de integridade: diagnóstico inicialmente **somente leitura**, por empresa; depois painel de ações autorizadas.
3. Vendedores: PIN de **2 dígitos apenas para identificação**, nunca para autenticação; PIN único por empresa, armazenamento seguro, vínculo nas OS/vendas e trilha de auditoria.
20. Testes ponta a ponta, pipeline de validação e gates de liberação.

Critérios: dados antigos preservados; não corrigir IDs, estoque, pagamentos ou OS automaticamente; checagens server-side de tenant; testar legados, duplicidades e permissões. Identificação de vendedor deve ser implementada no backend, não somente na interface.

## Etapa 2 — Operação, pagamento e materiais
2. Pagamento na OS com PIX e cartão via Mercado Pago, sem cobrança duplicada; webhooks assinados e reconciliação.
4. Estoque por veículo, ferramentas e materiais, transferência e baixa vinculada à OS.
6. Orçamento com aceite digital e conversão autorizada em OS.
8. Garantias e retornos ligados ao equipamento.
9. Prontuário por QR Code e histórico técnico.
12. Lucratividade por OS, contrato, cliente, obra e técnico.
13. Gestão de ferramentas, responsáveis e devolução.
14. Aprovações gerenciais para descontos, compras e gastos.
17. Comparativo e auditoria de fornecedores.
18. Execução de obras, medições, perdas e aditivos.

## Etapa 3 — Agenda e manutenção
7. Agenda com disponibilidade, localização, duração e deslocamento.
10. PMOC recorrente com criação idempotente de OS e controle de vencimentos.
19. Relatórios via WhatsApp apenas com autorização e confirmação.

## Etapa 4 — Fiscal, contratos públicos e automação
5. Copiloto IA: leitura e propostas de ação, confirmação humana para mutações.
11. Pré-auditoria fiscal de NCM, serviço, série, tributação e emissor.
15. Portal do cliente com controle granular de acesso.
16. Radar de contratos públicos, prazos e habilitação documental.

## Regras globais
- Preservar dados reais e isolamento multiempresa em banco, arquivos, relatórios e integrações.
- Reutilizar módulos e PRs existentes antes de criar fluxos duplicados; resolver conflitos em integração sequencial.
- Integrar frontend, API, persistência, autorização, auditoria e testes, sem criar apenas botões demonstrativos.
- Validar login, permissões, CRUD, pagamentos, estoque, OS, emissão fiscal, agenda, offline, WhatsApp e concorrência.
- Publicar **somente após CI e homologação**; confirmar Vercel READY e prever rollback.
- A primeira entrega deste PR consiste apenas no motor puro de diagnósticos e seus testes, não na interface nem no conjunto das 20 melhorias.
