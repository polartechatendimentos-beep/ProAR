# ProAR — Backlog de execução segura (08/10/2026)

## Política
- Fonte de verdade: branch `production` completa. Não substituir pelo `main` reduzido.
- Implementar em branches pequenas; CI, Preview e aprovação antes de promover.
- Produção: somente leitura/health checks sem autorização de escrita. Não excluir dados nem executar migrations destrutivas.
- Destino mobile: `/mobile`; preservar os fluxos do desktop e do Manager.
- Evidências separadas: build, testes, API, UX web/mobile, PDF e persistência.

## P0 — Estabilidade
- [ ] Confirmar registro de Engenheiro/Fiscal na API e autenticação no portal público (PRs #65 e #67); testar empresa, obra, usuário ativo/inativo e revogação.
- [ ] Validar conexão com banco e falhas HTTP 500/502/503 sem mascarar erros.
- [ ] Verificar isolamento por empresa, permissões e integridade das OS.

## P1 — Operação
- [x] Indicador de conectividade e armazenamento na rota /mobile (PR #68, CI aprovado; NÃO publicado).
- [ ] Persistência offline em IndexedDB, isolamento por tenant/usuário e expiração de sessão.
- [ ] Fila idempotente, retry e sincronização com confirmação por item; preservar fotos pendentes.
- [ ] Check-in offline, execução de OS, checklist, assinatura e conflitos com revisão humana.
- [ ] Agenda, estoque do técnico, notificações e histórico de equipamento.

## P2 — Relatórios e PDFs
- [ ] Auditar modelos existentes de OS, PMOC, orçamento e relatórios financeiros.
- [ ] Validar cabeçalho, rodapé, paginação, acentuação, tabelas, permissões e documentos longos.
- [ ] Criar testes com dados sintéticos para PDFs vazios, extensos e com anexos ausentes.

## P3 — UX e qualidade
- [ ] Testar /mobile em Android Chrome/PWA e iOS Safari, incluindo rotação e teclado.
- [ ] Estados de loading, erro, retry e acessibilidade por módulo.
- [ ] Monitor de versões e dispositivos com rollout canário PolarTech antes de outros tenants.

## Registro do ciclo
- Branch: `feat/mobile-safe-shell-status-20261008`.
- PR: https://github.com/polartechatendimentos-beep/ProAR/pull/68
- Commit: `e9855ed5507c1136f188320f08cf232b8829c78a`
- CI: `Validar ProAR` concluído com sucesso, run 37850281838.
- Produção: nenhuma escrita, migration ou deployment executado neste ciclo.
- Bloqueios: preview/produção e testes reais dependem de acesso autorizado ao escopo Vercel; teste de banco real não realizado.
- Próximo checkpoint: testes isolados da fila offline antes de integrar operações reais.
