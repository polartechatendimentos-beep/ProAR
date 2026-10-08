# Integração das melhorias — 08/10/2026

Edição completa do ProAR, base production e layout da publicação anterior preservados.

## Correção confirmada

Logs de produção de 08/10/2026 20:12 UTC: PostgreSQL 42703, coluna updated_by ausente em proar_state. O cadastro externo agora grava somente id, payload e updated_at; o responsável permanece em payload.updatedBy. Salvamento condicional por revisão impede perda de atualizações simultâneas. Falhas na leitura anterior não são convertidas em lista vazia. Confirmação compara os registros completos, sem depender da ordenação de chaves JSONB. Nenhuma migração destrutiva.

## Escopo integrado

- Layout compacto de Obras e Financeiro; tabela responsiva de composição frigorígena.
- Cadastro externo compacto com diagnóstico por incidente.
- Edição/exclusão de estruturas de clientes com preservação de vínculos; respeito à permissão de edição.
- Quantidade decimal em orçamentos; lista única e edição por botão ou duplo clique. Metadados e validade original preservados.
- Exclusão de OS pelo fluxo existente de integridade.
- Radar com cache, paginação, coleta em segundo plano, ranking, histórico e checkpoints por fonte.

## Conferência das 15 propostas estruturais

| Proposta | Recursos encontrados/integrados | Limite de validação |
| --- | --- | --- |
| 1. Banco, isolamento, migrações, recuperação | tenant-rest, state-snapshots, migrations, Manager recovery | Testes de isolamento; restauração real não executada em produção |
| 2. Publicação segura | production completa, proar-release.json, validate.yml, release guard | CI obrigatório e verificação do commit publicado |
| 3. Central de erros | system-observability, system-health; cadastro de Obras integrado | Persistência da central depende das tabelas configuradas; log permanece disponível |
| 4. Cadastro consistente | customer-crud, estrutura vinculada, gravação condicional | Fluxos existentes preservados; helper reutilizável state-commit |
| 5. Permissões | permissions, rbac, sessionCompany | Testes de matriz e isolamento |
| 6. Desempenho | cache e paginação do Radar, carregamento modular | Desempenho sob carga não medido |
| 7. Interface compacta | responsive-hardening, work-material-planning, Financeiro compacto | Layout da edição completa preservado |
| 8. Fluxo operacional | operational-ledger, transações e proteção de idempotência | Testes de domínio e transações |
| 9. Financeiro e cobrança | OperationalFinance, conciliação, billing Mercado Pago | Integrações reais dependem das credenciais e do provedor |
| 10. Fiscal | FiscalWorkspace, fiscal-validation, fila fiscal | Emissão/cancelamento real não executados; contingência depende da integração fiscal |
| 11. Obras | planejamento, materiais, etapas, custos e acesso externo | Falha SQL de cadastro corrigida; cálculo não reescrito |
| 12. PMOC | módulo e fluxos de OS/relatórios da edição completa | Execução real não simulada nos dados dos clientes |
| 13. Licitações | indexação e auditoria por fonte integradas | Fontes externas podem retornar resultados parciais; cobertura indicada |
| 14. Móvel/offline | ProARMobile, mobile-field-operation, sincronização | Testes de domínio; sincronização real depende da conectividade |
| 15. Assistente | assistente e contexto operacional da edição completa | Respostas reais dependem da configuração da API de IA |

As 15 propostas são um roteiro de evolução. Esta integração não certifica como concluídas integrações externas sem credenciais, testes de carga, restauração real, nem contingência fiscal. Rollback de código continua separado da recuperação manual do banco.
