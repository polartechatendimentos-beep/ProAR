# Auditoria ponta a ponta do ProAR — 01/10/2026

## Escopo analisado
Fluxo principal do ERP:
Cliente → estrutura/unidade → equipamento → orçamento → venda/OS → agenda/equipe → estoque/compras → financeiro → obra/PMOC → licitação pública → fiscal → relatórios/auditoria.

Arquivos e camadas observados:
- `app/page.tsx`: shell principal e grande parte dos módulos/estado da aplicação.
- `lib/operational-ledger.ts`: invariantes operacionais, financeiro, estoque, auditoria e idempotência de comandos.
- `lib/permissions.ts`: RBAC.
- `components/OperationalFinance.tsx`: títulos, contas, razão e conciliação.
- `components/InventoryOperations.tsx`: estoque/compras.
- `components/ServiceOrderWorkspace.tsx`: OS.
- `components/PublicContractsPanel.tsx` e workspace de licitações.
- `components/IntegrityAudit.tsx`: integridade.
- módulo fiscal desta branch.
- APIs de obras/acesso externo, cadastro, CNPJ e multiempresa.

## Resultado executivo
O ProAR já possui um núcleo operacional relevante e várias proteções no servidor. O principal ponto de evolução deixou de ser “adicionar telas”: é consolidar uma arquitetura modular, orientada a eventos e domínio, reduzindo o acoplamento do shell principal e garantindo rastreabilidade entre módulos.

### Pontos fortes encontrados
1. **Livro operacional no servidor**
   - `operational-ledger.ts` valida operações e não confia apenas em totais enviados pelo navegador.
   - histórico financeiro e estoque trabalham com movimentos.
   - baixas/estornos e recebimentos possuem validações.
   - existem proteções para duplicidade de títulos e documentos fiscais.

2. **Auditoria**
   - alterações operacionais relevantes alimentam auditoria server-side.
   - livros gerenciados não podem ser editados livremente pelo cliente.

3. **RBAC**
   - permissões são explícitas.
   - fiscal não herda automaticamente permissões de Financeiro/Vendas/OS.
   - perfis externos têm restrições adicionais.

4. **Estoque vinculado à operação**
   - conclusão de OS pode gerar saída de produto.
   - recebimento de compras alimenta livro de estoque.
   - saldo negativo é bloqueado.

5. **Financeiro**
   - suporta baixa parcial, juros, desconto, estorno e contas.
   - possui razão financeiro derivado.
   - origem dos títulos é rastreada.

6. **Clientes / OS / Equipamentos**
   - vínculo de equipamento com cliente/unidade é validado.
   - existe hierarquia operacional e estrutura de localização.

7. **Fiscal**
   - nesta branch passou a possuir preflight, roteamento, idempotência no bridge, eventos e conciliação com origem/financeiro.

---

# 1. Arquitetura

## Situação atual
`app/page.tsx` possui aproximadamente 500 mil caracteres e concentra muitos tipos, estados, formulários, decisões de navegação e módulos.

## Risco
- regressões ficam mais difíceis de isolar;
- build/teste precisa processar uma unidade muito grande;
- qualquer alteração visual pode atingir domínio não relacionado;
- tipos dinâmicos tendem a se espalhar;
- evolução mobile fica mais cara.

## Recomendação
Migrar de forma incremental, sem reescrever o ERP:
```
app/
  clientes/
  orcamentos/
  vendas/
  os/
  estoque/
  compras/
  financeiro/
  obras/
  licitacoes/
  fiscal/
  relatorios/
components/domain/
lib/domain/
```

Cada módulo deve receber apenas:
- registros que usa;
- comandos permitidos;
- callbacks explícitos;
- tipos próprios.

### Prioridade
P0 arquitetural, mas migração gradual.

---

# 2. Estado e persistência

## Situação
O ProAR usa estado agregado com `customers`, `serviceOrders` e `moduleRecords`, persistido no backend.

## Pontos positivos
- preserva compatibilidade com base histórica;
- o servidor recalcula livros derivados;
- possui revisão/auditoria operacional.

## Evolução recomendada
Manter o snapshot como camada de compatibilidade, porém migrar entidades críticas para comandos/eventos:
- `CustomerCreated`
- `BudgetApproved`
- `SaleConfirmed`
- `ServiceOrderCompleted`
- `PurchaseReceived`
- `PaymentSettled`
- `FiscalDocumentAuthorized`
- `WorkStageChanged`

Isso evita precisar transmitir grandes blocos de estado para toda alteração.

### Sugestão
Criar uma tabela/event store leve e uma fila de projeções, mantendo `proar_state` durante a transição.

---

# 3. Clientes e estrutura

## Já funciona
- cliente;
- unidades/setores;
- CNPJ automático;
- equipamentos vinculados;
- checagem de isolamento do equipamento na OS.

## Melhorias
- transformar a hierarquia em entidade canônica única:
  `Cliente > Secretaria/Setor > Unidade > Sala/Ambiente`;
- ID estável para cada nível;
- endereço fiscal separado de endereço operacional;
- endereço de cobrança separado;
- contatos por função;
- condições comerciais versionadas;
- histórico de alterações cadastrais;
- validação explícita da IE: contribuinte / isento / não contribuinte.

### Benefício
Fiscal, OS, orçamento e obras passam a usar o mesmo endereço/local sem duplicação.

---

# 4. CRM / orçamento / venda

## Melhorias
- pipeline comercial explícito;
- motivo de perda;
- follow-up automático;
- validade e aprovação;
- versão do orçamento;
- trilha de desconto/autorização;
- conversão orçamento → venda → OS sem redigitação;
- margem prevista por item;
- comparação orçamento x custo real após conclusão;
- regras de aprovação por desconto/margem;
- proposta com assinatura eletrônica.

## Indicadores
- taxa de conversão;
- ticket médio;
- tempo até fechamento;
- margem prevista x realizada;
- propostas sem retorno.

---

# 5. Ordens de Serviço / agenda

## Já funciona
- OS rica em dados;
- status;
- equipamento;
- fotos/assinaturas;
- manutenção futura;
- integração com estoque e financeiro em eventos importantes.

## Melhorias
- SLA;
- prioridade real;
- duração prevista x real;
- check-in geográfico opcional;
- checklist por tipo de serviço;
- bloqueio de conclusão quando checklist obrigatório estiver incompleto;
- consumo real de material na OS;
- horas por técnico;
- custo real de deslocamento;
- retorno/retrabalho vinculado à OS original;
- garantia de serviço;
- causa raiz da falha;
- agendamento inteligente por capacidade/rota.

---

# 6. Estoque / compras

## Já funciona
- livro de estoque;
- recebimento de compras;
- ajustes com motivo;
- bloqueio de saldo negativo;
- ligação com OS.

## Melhorias
- reserva de material antes da OS;
- estoque disponível = físico - reservado;
- estoque por local/almoxarifado/obra;
- lote/série;
- custo médio e último custo;
- requisição interna;
- transferência entre estoques;
- inventário com contagem cega;
- curva ABC;
- mínimo/máximo;
- previsão de compra por agenda/obras;
- importação DF-e/XML alimentando compra e estoque.

---

# 7. Financeiro

## Já funciona
- receber/pagar;
- baixa parcial;
- juros/desconto;
- estorno;
- contas e razão;
- origem dos títulos;
- controles contra duplicidade.

## Melhorias
- plano de contas gerencial;
- centro de custo;
- competência x caixa;
- rateio por obra/OS/unidade;
- DRE gerencial;
- fluxo projetado;
- conciliação bancária OFX/API;
- cobrança/PIX;
- parcelas nascidas automaticamente da condição da venda;
- conciliação fiscal automática;
- aging;
- aprovação de pagamento;
- anexos de comprovantes.

---

# 8. Obras

## Melhorias prioritárias
- orçamento da obra como baseline imutável;
- medição;
- custo previsto x realizado;
- material comprado/reservado/consumido;
- rateio por casa/quadra;
- apontamento por responsável;
- perdas e retrabalho;
- CNO/ART/RRT;
- diário de obra;
- fotos versionadas;
- aceite/fiscalização;
- aditivo contratual com aprovação;
- cronograma físico-financeiro;
- alerta de frente parada por falta de material.

---

# 9. PMOC / conformidade

## Melhorias
- plano por equipamento;
- periodicidade parametrizada;
- execução gera histórico imutável;
- responsável técnico;
- validade documental;
- anexos/laudos;
- assinatura;
- indicadores de pendência;
- fila assíncrona para PDFs pesados;
- compressão e armazenamento de fotos fora do estado principal.

---

# 10. Licitações

## Já existe
- certame;
- itens;
- saldo;
- fontes;
- pesquisa;
- workspace.

## Melhorias
- deduplicação por órgão/processo/item;
- prazo e agenda;
- documentos/certidões com validade;
- checklist por certame;
- composição de custo;
- limite mínimo de lance;
- autorização de lance;
- ata/contrato/empenho encadeados;
- execução vinculada à OS/entrega;
- saldo quantitativo e financeiro;
- alertas de renovação/validade;
- trilha de origem PNCP/Compras.gov.

---

# 11. Fiscal — implementado nesta evolução

## Emissão
- NF-e;
- NFC-e;
- NFS-e Mirassol/GOVBR;
- homologação/produção;
- preflight servidor;
- roteamento de autoridade;
- certificado/CSC/séries;
- finalidade;
- consumidor final;
- entrada/saída;
- destino;
- documentos referenciados;
- pagamentos;
- transporte;
- entrega/retirada;
- retenções;
- CNO;
- pessoas distintas NFS-e;
- IBS/CBS de classificação;
- cálculos matemáticos a partir de base/alíquota explicitamente informadas;
- idempotency key na ponte;
- tradução de rejeições;
- consulta;
- CC-e/eventos;
- inutilização;
- distribuição DF-e;
- contingência;
- DANFSe;
- conciliação fiscal.

## Regra crítica
O motor matemático não escolhe automaticamente uma tributação legal. Ele calcula usando parâmetros explicitamente cadastrados/confirmados. A decisão tributária deve ser suportada pelas tabelas oficiais e configuração fiscal validada.

---

# 12. Relatórios e BI

## Recomendação
Criar camada semântica única de métricas.
Evitar cada tela calcular KPIs de maneira diferente.

### Métricas centrais
- receita reconhecida;
- caixa;
- margem;
- custo técnico;
- custo material;
- conversão comercial;
- produtividade;
- retrabalho;
- estoque;
- obra;
- PMOC;
- licitações;
- fiscal.

### Evolução
- filtros compartilhados;
- drill-down até o documento origem;
- exportação XLSX/PDF;
- snapshots mensais para histórico.

---

# 13. Segurança

## Pontos positivos
- sessão;
- RBAC;
- segregação fiscal;
- cofre fiscal criptografado;
- multiempresa.

## Melhorias
- exigir MFA para Administrador/Financeiro/Fiscal;
- rotação de sessão;
- auditoria de login;
- alerta de tentativas;
- política de senha;
- permissões por ação em todos os endpoints;
- CSP e revisão periódica de dependências;
- logs sem segredos;
- segregação de anexos por tenant;
- assinatura/hashes de documentos fiscais;
- backup e recuperação testados.

---

# 14. Performance

## Gargalos prováveis
- shell principal muito grande;
- listas extensas em memória;
- fotos/documentos em fluxos operacionais;
- consultas globais sem paginação podem crescer com a base.

## Melhorias
- route-level code splitting;
- paginação server-side;
- virtualização de tabelas;
- lazy loading;
- cache control por domínio;
- thumbnails para fotos;
- jobs assíncronos;
- índices de busca;
- busca server-side para grandes bases.

---

# 15. Experiência do usuário

## Sugestões
1. **Hoje no ProAR**
   - somente ações que precisam de decisão.
2. **Busca global real**
   - cliente, OS, equipamento, proposta, NF, obra, certame.
3. **Timeline única**
   - histórico completo do cliente.
4. **Ações rápidas**
   - Nova OS, Orçamento, Venda, Recebimento, NF.
5. **Favoritos e filtros salvos**.
6. **Indicador de sincronização**.
7. **Erros acionáveis**
   - mensagem + campo + botão corrigir.
8. **Modo técnico mobile**
   - menos menus, tarefas da equipe.
9. **Atalhos de teclado** no desktop.
10. **Central de notificações** com prioridade.

---

# 16. Automações

Criar motor:
`Evento → Condição → Ação`

Exemplos:
- OS concluída → preparar faturamento;
- NF autorizada → vincular XML ao financeiro;
- orçamento sem resposta → tarefa de follow-up;
- estoque mínimo → sugestão de compra;
- compra recebida → atualizar custo;
- equipamento vencendo manutenção → tarefa comercial;
- certificado A1 vencendo → alerta;
- certidão vencendo → alerta;
- obra sem avanço → alerta;
- título vencido → régua de cobrança.

Nenhuma automação fiscal deve transmitir documento sem permissão e revisão compatíveis.

---

# 17. Qualidade / testes

## Recomendação
Além de unit/type/lint/build:
- Playwright E2E;
- testes de contrato de API;
- fixtures por perfil;
- homologação fiscal simulada;
- testes de concorrência;
- testes multiempresa;
- teste de recuperação de backup;
- testes mobile;
- teste de acessibilidade.

### Fluxos E2E mínimos
1. cliente → orçamento → venda → OS → estoque → financeiro → fiscal;
2. compra → recebimento → estoque → pagar;
3. obra → material → apontamento → medição;
4. licitação → empenho → execução → faturamento;
5. NF rejeitada → correção → autorização → cancelamento;
6. devolução/complementar;
7. usuário sem permissão tentando ação sensível.

---

# Priorização geral

## P0 — confiabilidade
- concluir homologação fiscal;
- idempotência/eventos fiscais;
- observabilidade;
- testes E2E;
- reduzir escrita de estado agregado em fluxos críticos;
- separar anexos/fotos do snapshot;
- padronizar concorrência/versão;
- backup/restauração testado.

## P1 — eficiência operacional
- modularizar app/page;
- automações;
- reservas de estoque;
- custo real/margem;
- planejamento de equipes;
- DRE/centros de custo;
- obras físico-financeiro;
- DF-e/importação XML.

## P2 — inteligência
- previsão de materiais;
- otimização de rotas;
- recomendação de compra;
- anomalias de margem;
- previsão de caixa;
- score comercial;
- copiloto de licitações;
- assistente fiscal explicável.

# Diretriz de evolução
Evitar uma nova reescrita total. Evoluir por domínio, mantendo compatibilidade e migrando cada módulo para componentes/APIs próprios com testes antes de remover o legado.
