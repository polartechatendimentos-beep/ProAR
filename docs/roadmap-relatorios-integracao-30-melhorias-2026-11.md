# ProAR — Plano de implementação integrado (30 melhorias)
Data: 2026-11-21. Estado: especificação em desenvolvimento; não homologado; não publicar automaticamente.

## Princípios obrigatórios
- Empresa/tenant resolvido no servidor; nunca confiar em tenantId enviado pelo navegador. Todas as leituras, assinaturas, anexos, números e aprovações filtrados pela empresa ativa.
- Preservar dados reais e layouts comerciais aprovados (orçamento PolarTech A4, cessão de crédito NFS-e 178); notas fiscais obedecem seus leiautes legais, sem timbre arbitrário.
- Reutilizar StandardDocumentReport e fluxos existentes; evitar recriar OS, orçamento, pedidos, estoque e financeiro.
- Operações críticas transacionais/idempotentes, trilha de auditoria append-only, permissões explícitas, rollback possível.
- Não presumir que assinatura desenhada equivale a assinatura eletrônica qualificada; armazenar evidências e modalidade de aceite.

## Fase 1 — Infraestrutura documental (itens 1–6)
1. Cabeçalho e rodapé únicos: componente DocumentLetterhead para relatórios A4, logo à esquerda, dados da empresa à direita, título/número/data; rodapé com versão e paginação. Aceite: PDF/print consistente em celular e desktop.
2. Empresa ativa: carregar logo, razão social, CNPJ, endereço, telefone, e-mail de configuração autorizada; não usar dados fiscais fictícios. Aceite: duas empresas geram documentos sem vazamento de identidade.
3. Número e QR: sequência atômica por tenant/tipo/ano, sem renumerar legados; QR aponta a endpoint público de verificação com token opaco e apenas dados mínimos. Aceite: concorrência sem duplicidade, revogação de documento cancelado.
4. Marca d'água: RASCUNHO e CANCELADO em preview/PDF; jamais em documentos fiscais oficiais. Aceite: status real prevalece sobre parâmetros da URL.
5. Paginação: CSS @page A4, thead display table-header-group, quebras controladas em blocos e anexos. Aceite: relatório 1, 3 e 20 páginas sem conteúdo cortado.
6. Preferências por tipo: tabela tenant_document_templates (tipo, versão, margens, tipografia, cores e logo habilitado); validação de valores e fallback seguro. Aceite: preferências não afetam outros tenants.

## Fase 2 — OS e prontuário técnico (itens 7–12)
7. Fotos antes/depois: anexos com etapa, equipamento, ordem, autor, horário e miniatura; preservar original e metadados. Aceite: ordenação estável e imagens privadas.
8. Assinaturas: cliente/técnico, nome, função, data/hora UTC, modalidade, evidência de aceite e hash do documento assinado; não alterar após finalização sem nova versão. Aceite: não há assinatura inventada quando ausente.
9. Checklist por serviço: modelos versionados de instalação, higienização, preventiva e corretiva; campos obrigatórios configuráveis. Aceite: bloquear conclusão apenas quando checklist aplicável estiver incompleto.
10. Itens mistos OS: produto, peça, insumo e serviço com unidade, quantidade, custo, preço, desconto, aprovação de aditivo e reserva/baixa de estoque idempotente. Aceite: edição e cancelamento não duplicam movimentações.
11. Histórico equipamento: QR para ficha autorizada, OS, medições, peças, garantias e anexos. Aceite: QR público não expõe dados pessoais.
12. Recomendações IA: saída marcada como sugestão, baseada apenas em dados observados, revisão humana obrigatória antes de anexar ao laudo. Aceite: IA não inventa medição ou serviço.

## Fase 3 — Comercial (itens 13–18)
13. Orçamento misto: linhas tipadas PRODUTO/SERVICO com regras tributárias separadas e totais conciliados. Aceite: soma exata com arredondamento decimal.
14. Kits: composição versionada e unidades fracionárias, com edição antes da confirmação. Aceite: estoque de insumos descontado somente no evento correto.
15. Conversão: orçamento aprovado -> pedido/OS por operação idempotente, mantendo referência ao original. Aceite: duplo clique não cria duplicata.
16. Versões: snapshots imutáveis com autor, data, diferenças de itens, valores e condições. Aceite: recuperar versão sem sobrescrever a atual.
17. Aprovação segura: link de token de uso limitado/expiração, identidade e consentimento, revogação, proteção contra enumeração. Aceite: links vencidos e de outro tenant rejeitados.
18. Financeiro: subtotal por tipo, descontos por linha/global, acréscimos, parcelamento, taxas e total; manter conciliação com recebíveis. Aceite: cálculos cobertos por testes de centavos.

## Fase 4 — IA e automações (itens 19–24)
19. Anotações -> laudo: IA redige rascunho citando evidências registradas; técnico aprova.
20. Resumo de OS: gerar somente com campos reais; sinalizar campos ausentes.
21. WhatsApp: fila de envio após aprovação explícita, consentimento, template/canal autorizado, logs e retentativas sem duplicidade.
22. Alertas: validar cliente, equipamento, serviço, técnico, fotos/assinaturas quando exigidas; mensagens acionáveis.
23. Leitura de anexos: extração com confirmação humana, segurança de uploads, limite de tamanho e prevenção de conteúdo malicioso.
24. Preventiva: recomendações baseadas em datas, periodicidade e histórico, sem alegar diagnóstico definitivo.

## Fase 5 — Central e operação (itens 25–30)
25. Central única: índice documental multi-módulo, sem migrar os documentos originais de imediato.
26. Filtros: cliente, equipamento, técnico, intervalo, status, tipo e empresa; paginação no servidor.
27. Exportação: PDF A4, CSV/XLSX conforme permissão, impressão, encoding e proteção contra fórmula em planilhas.
28. RBAC: checagem server-side por ação e tenant, testes de acesso cruzado.
29. Auditoria: eventos imutáveis com actor, timestamp, versão, ação, referência e diffs redigidos; sem segredos.
30. PDF assíncrono: fila persistente com status, tentativas limitadas, deduplicação, armazenamento privado, expiração de download e observabilidade; nunca bloquear a OS por timeout de geração.

## Sequência de entregas e critérios de liberação
- PR-A: timbre, tenant e impressão (1,2,4,5,6); QR/numeração (3) só após modelagem transacional.
- PR-B: OS e equipamento (7–12), incluindo testes de segurança e estoque.
- PR-C: comercial (13–18), com migração reversível e testes de totais.
- PR-D: IA/WhatsApp (19–24), recursos opt-in e revisão humana.
- PR-E: Central, permissões, auditoria, exportação e fila (25–30).
- Em cada PR: typecheck, lint, build, testes unitários e integração, validação mobile/A4, tenant A vs B, dados legados, preview Vercel.
- Homologar com usuários reais autorizados em ambiente de teste, sem enviar mensagens externas nem emitir notas fiscais reais.
- Publicar apenas após todos os gates aplicáveis aprovados; registrar SHA, deployment, smoke test, monitoramento e rollback.
- Bloqueios atuais: logo oficial/cadastro empresarial confirmado no tenant, cobertura dos relatórios existentes, testes automatizados e revisão das migrações. Não declarar os 30 itens implementados até a entrega correspondente.
