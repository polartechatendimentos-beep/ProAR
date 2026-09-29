# Auditoria completa ProAR — baseline 13cee47

Data: 29/09/2026
Baseline imutável analisado: 13cee4785fed86659a56d5de87ff1040d59cb408
Branch de auditoria: audit/proar-completa-13cee47
Regra: auditoria somente leitura; nenhuma migration, alteração de dados reais ou publicação em produção.

## Resumo executivo

A arquitetura atual deve ser endurecida incrementalmente, sem reescrita geral. O baseline já contém autenticação assinada, multiempresa, tenant dedicado, controle otimista de revisão, PWA shell, Radar PNCP/Compras.gov.br, Manager, cofre fiscal e credenciais de IA. Os riscos prioritários estão em autorização granular no backend, isolamento de tenant/empresa em rotas auxiliares, vínculos relacionais por texto na OS, snapshots monolíticos, fotos em base64, credenciais/configurações globais compartilhadas e cobertura de testes insuficiente.

## CRÍTICO

### SEC-01 — RBAC central inexistente nas mutações operacionais
Arquivos: app/api/work-projects/route.ts, app/api/state/route.ts, app/api/public-work-map/route.ts, app/api/nfse/issue/route.ts, app/api/nfe/distribution/route.ts.
Evidência: várias rotas de escrita validam somente uma sessão válida. Não há autorização por módulo/ação/escopo antes da mutação.
Impacto: um perfil autenticado com baixa permissão pode tentar a API diretamente, independentemente de botão oculto.
Correção: helper único requirePermission(request, permission, scope), catálogo de permissões, escopo company/unit/sub_unit/work, 403 padronizado, auditoria de permit/deny. Primeiro proteger obras.status, financeiro.*, os.*, equipamentos.*, licitacoes.*, configuracoes.*.
Teste obrigatório: Fiscal chama mutação de status diretamente => 403; Administrador autorizado => sucesso em ambiente de teste.

### SEC-02 — Escopo de empresa controlável pelo corpo/query em rotas autenticadas
Arquivos: app/api/public-work-map/route.ts, app/api/public-service-order/route.ts; observar também fallback legado em work-projects.
Evidência: sessão é verificada, mas companyId/requestedCompany pode vir do request sem comparação obrigatória com session.companyId.
Impacto: risco de leitura/gravação cross-tenant se um usuário autenticado alterar companyId.
Correção: para sessão tenant, companyId deve ser exclusivamente session.companyId. Rejeitar mismatch. Resolver banco via resolveTenantDb(session.companyId), não acessar master diretamente para dados operacionais.

### SEC-03 — Configuração fiscal e WhatsApp são globais, não por tenant
Arquivos: app/api/fiscal-config/route.ts, lib/proar-whatsapp.ts.
Evidência: STORAGE_PATH fixo proar/configuracao-fiscal.enc e proar/whatsapp-config.enc.
Impacto: em SaaS multiempresa, configurações/credenciais de uma empresa podem substituir as de outra.
Correção: namespace por companyId validado da sessão, chave/registro por tenant e auditoria. Migrar sem apagar configuração existente: legado vira configuração exclusiva da empresa principal após confirmação.

### SEC-04 — Senha padrão insegura no cron do Manager
Arquivo: app/api/cron/manager-daily-check/route.ts.
Evidência: fallback literal para senha de Tiago quando PROAR_POLARTECH_TIAGO_PASSWORD não existe; cron também regrava hash do usuário.
Impacto: credencial previsível e possibilidade de redefinição recorrente.
Correção: remover fallback; requiredSecret; não regravar senha se usuário já existe; forçar troca quando bootstrap realmente necessário; auditar bootstrap sem registrar segredo.

### DATA-01 — Isolamento relacional da OS depende de texto
Arquivo: components/ServiceOrderWorkspace.tsx.
Evidência: cliente/unidade/sala/equipamento são relacionados por nomes; linkedEquipment usa combinações sameClient/sameRoom/sameUnit.
Impacto: equipamento de outra subunidade pode aparecer/ser associado quando nomes coincidem ou a condição booleana aceita combinação ampla.
Correção incremental: adicionar customerId, unitId, subUnitId, environmentId e equipmentId aos registros novos; seletor estrito por IDs; backend revalida equipamento contra cadeia da OS. Preservar campos textuais como snapshot histórico.
Teste sentinela: AC-00154 da UBS Central em OS Escola Municipal/UBS Sul => bloqueado.

### DATA-02 — Estado operacional monolítico em proar_state
Arquivo: app/api/state/route.ts.
Evidência: customers, serviceOrders e moduleRecords são gravados em um payload JSON com revisão global.
Impacto: qualquer alteração concorre com o snapshot inteiro; escala, auditoria e integridade relacional ficam limitadas.
Correção: migração aditiva e gradual por domínio, mantendo adapter compatível. Começar por entidades de maior concorrência: OS, equipamentos, obras/eventos, financeiro. updated_at/version/updated_by por registro. Não remover proar_state até validação completa.

## ALTO

### SEC-05 — Modelo de permissões mistura módulos da empresa e permissões do usuário
Arquivo: app/api/auth/route.ts.
Evidência: para usuário não-Tiago, permissions pode receber company.modules quando a empresa possui módulos.
Impacto: módulo contratado e autorização do usuário tornam-se conceitos misturados.
Correção: effectivePermissions = interseção do plano/módulos habilitados com role/user permissions. Administrador não deve depender de exceção por username.

### SEC-06 — APIs públicas procuram tokens varrendo registros
Arquivos: app/api/public-work-map/route.ts, app/api/public-service-order/route.ts.
Evidência: consultas id=like.workmap-* / osmap-* e busca do token em memória.
Impacto: custo crescente e maior superfície de dados lidos pelo service role.
Correção: índice/tabela ou identificador derivado de hash do token; consulta direta; expiração/revogação do token.

### DATA-03 — Obras ainda persistidas como snapshot
Arquivo: app/api/work-projects/route.ts.
Evidência: projects[] inteiro + revision em proar_state.
Correção: eventos append-only para alterações de casa/status/apontamento; snapshot derivado para leitura; autorização por ação e workId.

### FIELD-01 — Fotos da OS continuam em base64
Arquivo: components/ServiceOrderWorkspace.tsx.
Evidência: FileReader.readAsDataURL e photos no draft.
Impacto: payload grande, memória alta, sincronização lenta e risco de timeout.
Correção: compressão cliente/servidor, Storage privado, metadados/URL no estado; fila IndexedDB para upload offline; retry idempotente.

### FIELD-02 — PWA atual é somente app-shell
Arquivo: public/sw.js.
Evidência: cache do shell e fallback de navegação; chamadas /api são ignoradas.
Impacto: não protege apontamentos/fotos contra perda de sinal.
Correção: IndexedDB outbox, estados Pendente/Enviando/Sincronizado/Erro, background sync quando suportado e fallback ao evento online; hash/idempotency key.

### PERF-01 — Radar executa múltiplas fontes em request interativo
Arquivo: app/api/licitacoes/route.ts.
Evidência: PNCP por UFs + Compras por modalidades, retries/timeouts e cache no-store.
Impacto: latência e variabilidade.
Correção: ingestão assíncrona/persistente; UI pesquisa índice local; cache por chave/hash; refresh em background; detalhe oficial sob demanda.

### LIC-01 — Fluxo de licitações possui estado importante em localStorage
Arquivo: components/BiddingOperationsWorkspace.tsx.
Evidência: inbox/status e cofre inicial usam localStorage.
Impacto: fluxo não é multiusuário/confiável e pode divergir entre computadores.
Correção: persistir status, checklist, cofre, decisões e auditoria no backend por tenant. LocalStorage apenas cache.

### CNPJ-01 — Cadastro operacional valida apenas comprimento antes da consulta
Arquivos: app/api/cnpj/[cnpj]/route.ts, app/api/companies/route.ts.
Evidência: trial/register possui algoritmo de CNPJ, mas as rotas operacionais aceitam 14 dígitos sem validar dígitos verificadores.
Correção: extrair validCnpj/validCpf para lib/document-validation.ts e reutilizar em todas as entradas. Adicionar ViaCEP como fallback/complemento de endereço, sem sobrescrever campos revisados pelo usuário.

### FIN-01 — Financeiro precisa sair do snapshot para transações auditáveis
Base: app/page.tsx + proar_state.
Correção: conta, parcela, baixa, estorno e conciliação como registros; idempotência; baixa parcial; trilha de auditoria; cartões vencidas/hoje/a vencer e baixa rápida condicionada à permissão.

## MÉDIO

### QA-01 — Quality gate existe, mas cobertura é insuficiente
Arquivo: package.json e .github/workflows/validate.yml.
Evidência: npm test = node --test e lint aponta apenas app/api/licitacoes/route.ts.
Correção: eslint .; testes unitários, API, RBAC, isolamento tenant, integridade relacional e Playwright E2E. Produção recebe somente smoke read-only.

### OBS-01 — Health endpoint não testa a cadeia operacional
Arquivo: app/api/health/tenant/route.ts.
Evidência: confirma cadastro/status do tenant, mas não valida sessão, resolução do DB, leitura mínima, IA/storage/integrações.
Correção: health interno autenticado no Manager com checks separados e sem segredos: domínio, auth, tenant resolution, DB, storage, OpenAI, PNCP, WhatsApp, fiscal.

### AI-01 — Credencial de IA está protegida, mas falta governança operacional
Arquivos: app/api/ai-credential/route.ts, lib/openai-credential.ts, app/api/equipment-label/route.ts.
Pontos positivos: segredo criptografado, fallback server-side e chave não enviada ao cliente.
Melhorias: timeout, rate limit por tenant/usuário, orçamento de tokens, logging sem conteúdo sensível, modelo configurável server-side, retry controlado e tratamento de 429/5xx.

### TENANT-01 — Provisionamento dedicado ainda cria esquema mínimo
Arquivo: lib/tenant-provisioning.ts.
Evidência: operationalSchema cria somente proar_state, proar_work_projects e proar_public_work_maps.
Correção: versionar bootstrap e migrations aditivas por tenant; registrar schema_version; health verifica versão; nunca provisionar parcialmente como ready.

### AUTH-01 — Sessão assinada é boa, mas falta revogação/versionamento
Arquivo: lib/proar-auth.ts.
Correção: session_version/user_version ou session id revogável para bloquear imediatamente usuário/permissão alterada; rotação segura de segredo; registrar last login e tentativas sem armazenar senha.

## UX / ACESSIBILIDADE

### UX-01 — Padronizar alvo de toque >= 44x44
Aplicar design token global para button, icon-button, select, tabs e controles usados em campo. Validar mobile com luvas.

### UX-02 — Financeiro com semântica visual
Cards: Vencidas, Vencem hoje, Próximos 7 dias, A receber, A pagar. Cores nunca como único indicador; incluir texto/ícone. Baixa em 1 clique abre confirmação e respeita permissão.

### UX-03 — Licitações orientadas à ação
Tela inicial: O que preciso fazer hoje?; filtros HVAC; distância; prazo; órgão; origem; score explicável; “Por que apareceu?” e diagnóstico “Por que não apareceu?”. Manter Certames/Saldo como etapa posterior.

### UX-04 — Feedback e resiliência
Padronizar “Alteração efetuada”, erro acionável, loading, retry, conflito 409 e estado offline/sincronização.

## Pontos positivos a preservar

- Sessões HMAC com segredo obrigatório e cookies httpOnly.
- Isolamento explícito no resolveTenantDb: tenant não cai silenciosamente no master.
- Controle otimista de revisão em state.
- Credencial OpenAI criptografada por empresa e fallback apenas no servidor.
- Cofre fiscal criptografado.
- Cron protegido por CRON_SECRET.
- Trial com Turnstile opcional, rate limit e validação matemática CPF/CNPJ.
- Workflow CI já chama validate.
- PWA shell já existe e pode ser evoluído sem refazer o app.
- Radar já possui timeouts, concorrência limitada, diagnóstico de fontes e fallback de última busca válida.

## Plano de implementação incremental

Fase 1: RBAC central + isolamento tenant + remover senha fallback + testes de autorização.
Fase 2: IDs relacionais na OS/equipamentos + validação CNPJ compartilhada + auditoria.
Fase 3: Storage/fotos/offline outbox + PDF assíncrono.
Fase 4: Radar persistente/cache/worker + teste sentinela PNCP.
Fase 5: financeiro/estoque transacionais.
Fase 6: migração progressiva do proar_state por entidade.
Fase 7: Playwright + regressão visual + Quality Gate + smoke produção read-only.
Fase 8: UX global 44px, semântica financeira e refinamento visual.

## Testes sentinela obrigatórios

1. Fiscal tenta alterar status de obra por API => 403.
2. Técnico sem financeiro chama endpoint financeiro => 403.
3. Usuário tenant A envia companyId tenant B => 403.
4. AC-00154 UBS Central em OS UBS Sul/Escola => bloqueado.
5. OS antiga preserva localização histórica após transferência do equipamento.
6. Duas gravações concorrentes => uma recebe 409, sem perda silenciosa.
7. Foto 4K => comprimida/upload assíncrono; OS não carrega base64 gigante.
8. Queda de rede durante apontamento => outbox local e sincronização posterior idempotente.
9. Edital PNCP-45141132000171-1-000072-2026 => teste sentinela do Radar.
10. Perfil/módulo/permissão alterado => sessão antiga perde autorização após revogação/versionamento.
11. Produção smoke read-only: domínio, login, sessão, DB, módulos, logout.

## Regra de publicação

Nenhuma correção desta auditoria deve ir direto à produção. Cada lote: branch de feature a partir do baseline/descendente verificado → diff → typecheck → lint global → testes → build → preview → QA → aprovação → merge/promoção. Nenhuma migration destrutiva; nenhuma exclusão de dados reais.
